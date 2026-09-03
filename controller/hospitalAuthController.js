const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const HospitalModel = require('../model/hospitalModel');

const JWT_SECRET = process.env.JWT_SECRET || 'trividha-dev-secret-change-in-production';

/* ---------------- Mail (for OTP) ---------------- */
let mailer = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
} else {
  console.warn('\n  [mail] EMAIL_USER / EMAIL_PASS not set -- OTPs will be printed to this console instead of emailed.\n');
}

async function sendOtpEmail(toEmail, otp) {
  if (!mailer) {
    console.log(`  [mail] (no SMTP configured) OTP for ${toEmail}: ${otp}`);
    return;
  }
  await mailer.sendMail({
    from: `"Trividha Hospital Portal" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Trividha — Password reset code',
    text: `Your Trividha password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your Trividha password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`
  });
}

/* ---------------- Helpers ---------------- */
function signToken(hospital) {
  return jwt.sign({ id: hospital.hospital_id, email: hospital.login_email }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const token = req.cookies.trividha_token;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.hospitalId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];
function isGmailAddress(email) {
  const at = String(email || '').toLowerCase().trim().split('@');
  return at.length === 2 && GMAIL_DOMAINS.includes(at[1]);
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function setAuthCookie(res, token) {
  res.cookie('trividha_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
}

/* ---------------- Controller actions ---------------- */
exports.authRequired = authRequired;

exports.signup = async (req, res) => {
  try {
    const { hospitalName, email, password } = req.body;
    if (!hospitalName || !email || !password) {
      return res.status(400).json({ error: 'Hospital name, email and password are all required.' });
    }
    if (!isGmailAddress(email)) {
      return res.status(400).json({ error: 'Please sign up with a Gmail address (must end with @gmail.com).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await HospitalModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const hospital = await HospitalModel.create({ name: hospitalName, email, passwordHash });
    setAuthCookie(res, signToken(hospital));
    res.json({ hospital: HospitalModel.publicHospital(hospital) });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong creating your account. Please try again.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const hospital = await HospitalModel.findByEmail(email);
    if (!hospital || !bcrypt.compareSync(password, hospital.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    setAuthCookie(res, signToken(hospital));
    res.json({ hospital: HospitalModel.publicHospital(hospital) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong signing you in. Please try again.' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('trividha_token');
  res.json({ ok: true });
};

exports.me = async (req, res) => {
  try {
    const hospital = await HospitalModel.findById(req.hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });
    res.json({ hospital: HospitalModel.publicHospital(hospital) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Please enter your email.' });
    if (!isGmailAddress(email)) {
      return res.status(400).json({ error: 'Please use the Gmail address your hospital account was registered with.' });
    }
    const hospital = await HospitalModel.findByEmail(email);
    if (!hospital) return res.status(404).json({ error: 'No hospital account uses that email.' });

    const otp = genOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await HospitalModel.setResetOtp(hospital.hospital_id, otp, expires);

    try {
      await sendOtpEmail(hospital.login_email, otp);
    } catch (e) {
      console.error('Failed to send OTP email:', e.message);
      return res.status(500).json({ error: 'Could not send the reset email. Please try again shortly.' });
    }
    res.json({ ok: true, message: 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, code and new password are all required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const hospital = await HospitalModel.findByEmail(email);
    if (!hospital || !hospital.reset_otp || !hospital.reset_otp_expires) {
      return res.status(400).json({ error: 'Please request a new code first.' });
    }
    if (new Date(hospital.reset_otp_expires).getTime() < Date.now()) {
      return res.status(400).json({ error: 'That code has expired. Please request a new one.' });
    }
    if (String(otp).trim() !== hospital.reset_otp) {
      return res.status(400).json({ error: 'Incorrect code.' });
    }
    await HospitalModel.updatePassword(hospital.hospital_id, bcrypt.hashSync(newPassword, 10));
    await HospitalModel.clearResetOtp(hospital.hospital_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
