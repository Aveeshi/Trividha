/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — patient controller
 * ========================================================================== */

const patientModel = require('../model/patient');
const { readAuthCookie, clearAuthCookies } = require('../utils/authCookies');

// Route guard: every /patient/* route requires a logged-in patient session.
async function ensurePatient(req, res, next) {
  // The session store is in-memory (see app.js), so a server restart clears
  // req.session even though the isLoggedIn/userLoggedIn cookies survive.
  // Re-hydrate the session from that cookie before giving up on the user.
  if (!req.session.patientId) {
    const cookieAuth = readAuthCookie(req);
    if (cookieAuth && cookieAuth.role === 'patient') {
      req.session.patientId = cookieAuth.id;
    }
  }

  if (!req.session.patientId) {
    return res.redirect('/login/patient');
  }

  try {
    const patient = await patientModel.findById(req.session.patientId);
    if (!patient) {
      req.session.patientId = null;
      clearAuthCookies(res);
      return res.redirect('/login/patient');
    }
    req.patient = patient;
    return next();
  } catch (err) {
    console.error('patientController.ensurePatient error:', err);
    return res.status(500).send('Something went wrong.');
  }
}

function dashboard(req, res) {
  const patient = req.patient;
  res.render('patient/dashboard', {
    patient,
    account: {
      name: `${patient.first_name} ${patient.last_name}`.trim(),
      initials: `${(patient.first_name || '')[0] || ''}${(patient.last_name || '')[0] || ''}`.toUpperCase(),
      homeHref: '/patient/dashboard',
    },
  });
}

module.exports = { ensurePatient, dashboard };
