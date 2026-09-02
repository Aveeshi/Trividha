/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — doctor controller
 * ========================================================================== */

const doctorModel = require('../model/doctor');
const { readAuthCookie, clearAuthCookies } = require('../utils/authCookies');

// Route guard: every /doctor/* route requires a logged-in doctor session.
async function ensureDoctor(req, res, next) {
  // The session store is in-memory (see app.js), so a server restart clears
  // req.session even though the isLoggedIn/userLoggedIn cookies survive.
  // Re-hydrate the session from that cookie before giving up on the user.
  if (!req.session.doctorId) {
    const cookieAuth = readAuthCookie(req);
    if (cookieAuth && cookieAuth.role === 'doctor') {
      req.session.doctorId = cookieAuth.id;
    }
  }

  if (!req.session.doctorId) {
    return res.redirect('/login/doctor');
  }

  try {
    const doctor = await doctorModel.findById(req.session.doctorId);
    if (!doctor) {
      req.session.doctorId = null;
      clearAuthCookies(res);
      return res.redirect('/login/doctor');
    }
    req.doctor = doctor;
    return next();
  } catch (err) {
    console.error('doctorController.ensureDoctor error:', err);
    return res.status(500).send('Something went wrong.');
  }
}

function dashboard(req, res) {
  const doctor = req.doctor;
  res.render('doctor/dashboard', {
    doctor,
    account: {
      name: `Dr. ${doctor.name}`.trim(),
      initials: (doctor.name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase(),
      homeHref: '/doctor/dashboard',
    },
  });
}

module.exports = { ensureDoctor, dashboard };
