/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — auth controller
 * Handles /login/:role for every role. "patient" (Aadhaar/ABHA + OTP + signup)
 * and "doctor" (email + password) are fully wired up; hospital/kiosk render a
 * placeholder until their real login flows exist.
 * ========================================================================== */

const patientModel = require('../model/patient');
const doctorModel = require('../model/doctor');
const { setAuthCookies, clearAuthCookies } = require('../utils/authCookies');
const otpService = require('../utils/otpService');

const VALID_ROLES = ['patient', 'doctor', 'hospital', 'kiosk'];

// Minimum gap between OTP sends for one login attempt, so a mis-click on
// "Resend" doesn't fire off a dozen SMS in a row.
const RESEND_COOLDOWN_MS = 30 * 1000;

function showLogin(req, res) {
  const { role } = req.params;

  if (!VALID_ROLES.includes(role)) {
    return res.status(404).send('Unknown login role.');
  }

  if (role === 'patient') {
    return res.render('auth/patient-login', { error: null });
  }
  if (role === 'doctor') {
    return res.render('auth/doctor-login', { error: null });
  }

  return res.render('auth/coming-soon', { role });
}

// Step 1: patient submits Aadhaar OR ABHA ID. We look up whether they already
// have an account, stash that in the session, and send an OTP via Twilio
// Verify to the fixed demo recipient list (see utils/otpService.js) — we
// don't have the sandbox.abdm.gov.in API key yet, so this stands in for the
// real Aadhaar/ABHA-linked SMS OTP until that's integrated. Every
// submission, whatever the Aadhaar/ABHA ID, goes to the same demo numbers.
async function sendOtp(req, res) {
  const aadhaar = (req.body.aadhaar || '').trim();
  const abha = (req.body.abha || '').trim();

  const aadhaarValid = /^\d{12}$/.test(aadhaar);
  const abhaValid = /^\d{14}$/.test(abha);

  if (!aadhaarValid && !abhaValid) {
    return res.render('auth/patient-login', {
      error: 'Enter a valid 12-digit Aadhaar number or 14-digit ABHA ID.',
    });
  }
  if (aadhaarValid && abhaValid) {
    return res.render('auth/patient-login', {
      error: 'Enter only one: Aadhaar number or ABHA ID, not both.',
    });
  }

  try {
    const existing = aadhaarValid
      ? await patientModel.findByAadhaar(aadhaar)
      : await patientModel.findByAbha(abha);

    await otpService.sendOtpSms();

    req.session.patientAuth = {
      aadhaar: aadhaarValid ? aadhaar : null,
      abha: abhaValid ? abha : null,
      existingId: existing ? existing.patient_id : null,
      otpSentAt: Date.now(),
    };

    return res.render('auth/otp', {
      error: null,
      notice: null,
      identifier: aadhaarValid ? aadhaar : abha,
    });
  } catch (err) {
    console.error('authController.sendOtp error:', err);
    return res.render('auth/patient-login', {
      error: 'Something went wrong sending the OTP. Please try again.',
    });
  }
}

// "Resend OTP" from the OTP screen: reuses the pending Aadhaar/ABHA lookup
// already in the session and re-sends via Twilio Verify to the same demo
// recipient list.
async function resendOtp(req, res) {
  const pending = req.session.patientAuth;
  if (!pending) {
    return res.redirect('/login/patient');
  }

  const identifier = pending.aadhaar || pending.abha;

  if (pending.otpSentAt && Date.now() - pending.otpSentAt < RESEND_COOLDOWN_MS) {
    const waitSecs = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - pending.otpSentAt)) / 1000);
    return res.render('auth/otp', {
      error: `Please wait ${waitSecs}s before requesting another OTP.`,
      notice: null,
      identifier,
    });
  }

  try {
    await otpService.sendOtpSms();

    pending.otpSentAt = Date.now();
    req.session.patientAuth = pending;

    return res.render('auth/otp', {
      error: null,
      notice: 'A new OTP has been sent.',
      identifier,
    });
  } catch (err) {
    console.error('authController.resendOtp error:', err);
    return res.render('auth/otp', {
      error: 'Could not resend the OTP. Please try again.',
      notice: null,
      identifier,
    });
  }
}

// Step 2: verify the OTP against what Twilio Verify sent out. Twilio owns
// expiry (10 minutes by default), so a wrong OR expired code both just come
// back "not approved" here. Existing patients go straight to the dashboard;
// new ones move on to signup.
async function verifyOtp(req, res) {
  const pending = req.session.patientAuth;
  if (!pending) {
    return res.redirect('/login/patient');
  }

  const identifier = pending.aadhaar || pending.abha;
  const otp = (req.body.otp || '').trim();

  if (!/^\d{4,10}$/.test(otp)) {
    return res.render('auth/otp', {
      error: 'Enter the OTP you received.',
      notice: null,
      identifier,
    });
  }

  let approved = false;
  try {
    approved = await otpService.checkOtp(otp);
  } catch (err) {
    console.error('authController.verifyOtp error:', err);
    return res.render('auth/otp', {
      error: 'Something went wrong checking the OTP. Please try again.',
      notice: null,
      identifier,
    });
  }

  if (!approved) {
    return res.render('auth/otp', {
      error: "OTP doesn't match.",
      notice: null,
      identifier,
    });
  }

  if (pending.existingId) {
    req.session.patientId = pending.existingId;
    delete req.session.patientAuth;
    setAuthCookies(res, 'patient', pending.existingId);
    return res.redirect('/patient/dashboard');
  }

  return res.render('auth/signup', {
    error: null,
    aadhaar: pending.aadhaar || '',
    abha: pending.abha || '',
  });
}

// Step 3 (new patients only): create the patient record, then log them in.
async function signup(req, res) {
  const pending = req.session.patientAuth;
  if (!pending) {
    return res.redirect('/login/patient');
  }

  const { first_name, last_name, email, phone_number, gender, date_of_birth } = req.body;
  const aadhaar_number = (req.body.aadhaar_number || pending.aadhaar || '').trim();
  const abha_id = (req.body.abha_id || pending.abha || '').trim();

  const rerender = (error) =>
    res.render('auth/signup', {
      error,
      aadhaar: pending.aadhaar || aadhaar_number,
      abha: pending.abha || abha_id,
    });

  if (!/^\d{12}$/.test(aadhaar_number)) {
    return rerender('A valid 12-digit Aadhaar number is required.');
  }
  if (abha_id && !/^\d{14}$/.test(abha_id)) {
    return rerender('ABHA ID must be exactly 14 digits.');
  }
  if (!first_name || !last_name || !phone_number || !date_of_birth) {
    return rerender('Please fill in all required fields.');
  }

  try {
    const patient = await patientModel.create({
      aadhaar_number,
      abha_id,
      first_name,
      last_name,
      email,
      phone_number,
      gender: gender ? gender.toUpperCase() : gender,
      date_of_birth,
    });

    req.session.patientId = patient.patient_id;
    delete req.session.patientAuth;
    setAuthCookies(res, 'patient', patient.patient_id);
    return res.redirect('/patient/dashboard');
  } catch (err) {
    console.error('authController.signup error:', err);
    const message =
      err.code === '23505'
        ? 'An account with this Aadhaar or ABHA ID already exists.'
        : 'Could not create your account. Please try again.';
    return rerender(message);
  }
}

// Doctor login: plain email + password against the doctor table.
async function doctorLogin(req, res) {
  const login_email = (req.body.login_email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!login_email || !password) {
    return res.render('auth/doctor-login', { error: 'Enter your email and password.' });
  }

  try {
    const doctor = await doctorModel.findByEmail(login_email);
    const ok = doctor && (await doctorModel.verifyPassword(doctor, password));
    if (!ok) {
      return res.render('auth/doctor-login', { error: 'Invalid email or password.' });
    }
    req.session.doctorId = doctor.doctor_id;
    setAuthCookies(res, 'doctor', doctor.doctor_id);
    return res.redirect('/doctor/dashboard');
  } catch (err) {
    console.error('authController.doctorLogin error:', err);
    return res.render('auth/doctor-login', { error: 'Something went wrong. Please try again.' });
  }
}

function showDoctorSignup(req, res) {
  return res.render('auth/doctor-signup', { error: null, form: {} });
}

// Doctor signup: government_doctor_id, name, specialization, qualification,
// experience_years, login_email + password — matches the `doctor` table.
async function doctorSignup(req, res) {
  const {
    government_doctor_id,
    name,
    qualification,
    experience_years,
    login_email,
    password,
    confirm_password,
  } = req.body;

  // "Other" in the specialization dropdown opens a free-text field — prefer that value.
  const specialization =
    req.body.specialization === 'Other' && req.body.specialization_other
      ? req.body.specialization_other.trim()
      : req.body.specialization;

  const rerender = (error) =>
    res.render('auth/doctor-signup', {
      error,
      form: { government_doctor_id, name, specialization, qualification, experience_years, login_email },
    });

  if (!government_doctor_id || !name || !login_email || !password) {
    return rerender('Please fill in all required fields.');
  }
  if (password.length < 8) {
    return rerender('Password must be at least 8 characters.');
  }
  if (password !== confirm_password) {
    return rerender('Passwords do not match.');
  }

  try {
    const doctor = await doctorModel.create({
      government_doctor_id: government_doctor_id.trim(),
      login_email: login_email.trim().toLowerCase(),
      password,
      name: name.trim(),
      specialization,
      qualification,
      experience_years: experience_years ? parseInt(experience_years, 10) : null,
    });

    req.session.doctorId = doctor.doctor_id;
    setAuthCookies(res, 'doctor', doctor.doctor_id);
    return res.redirect('/doctor/dashboard');
  } catch (err) {
    console.error('authController.doctorSignup error:', err);
    const message =
      err.code === '23505'
        ? 'An account with this Government Doctor ID or email already exists.'
        : 'Could not create your account. Please try again.';
    return rerender(message);
  }
}

function logout(req, res) {
  clearAuthCookies(res);
  req.session.destroy(() => res.redirect('/'));
}

module.exports = {
  showLogin,
  sendOtp,
  resendOtp,
  verifyOtp,
  signup,
  doctorLogin,
  showDoctorSignup,
  doctorSignup,
  logout,
};
