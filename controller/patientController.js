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

// Shared account-menu shape for every /patient/* page (topbar.ejs). Reused
// by documentController for the scan-upload/documents pages.
function buildAccount(patient) {
  return {
    name: `${patient.first_name} ${patient.last_name}`.trim(),
    initials: `${(patient.first_name || '')[0] || ''}${(patient.last_name || '')[0] || ''}`.toUpperCase(),
    homeHref: '/patient/dashboard',
    documentsHref: '/patient/dashboard/documents',
  };
}

function dashboard(req, res) {
  res.render('patient/dashboard', {
    patient: req.patient,
    account: buildAccount(req.patient),
  });
}

module.exports = { ensurePatient, dashboard, buildAccount };
