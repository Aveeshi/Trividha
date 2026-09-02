/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — persistent login cookies
 *
 * express-session here uses the default MemoryStore (see app.js), so every
 * session is wiped when the server restarts. These two cookies are the
 * survivable half of "stay logged in": they outlive a restart and let the
 * route guards (ensurePatient / ensureDoctor) re-hydrate req.session instead
 * of bouncing an already-known user back to the login screen.
 *
 *   isLoggedIn   - "true" while someone is logged in, nothing otherwise.
 *   userLoggedIn - "<role>:<id>", e.g. "patient:12" or "doctor:7", so the
 *                  guard knows which table to re-check the id against.
 *
 * They are NOT the source of truth for authorization — every request still
 * re-verifies the id against the database (see ensurePatient/ensureDoctor).
 * A stale or tampered cookie just fails that check and gets cleared.
 * ========================================================================== */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const COOKIE_OPTS = {
  maxAge: THIRTY_DAYS_MS,
  httpOnly: true,
  sameSite: 'lax',
};

function setAuthCookies(res, role, id) {
  res.cookie('isLoggedIn', 'true', COOKIE_OPTS);
  res.cookie('userLoggedIn', `${role}:${id}`, COOKIE_OPTS);
}

function clearAuthCookies(res) {
  res.clearCookie('isLoggedIn');
  res.clearCookie('userLoggedIn');
}

// Parses the "userLoggedIn" cookie into { role, id }, or null if missing/malformed.
function readAuthCookie(req) {
  const raw = req.cookies && req.cookies.userLoggedIn;
  if (!raw || req.cookies.isLoggedIn !== 'true') return null;

  const sep = raw.indexOf(':');
  if (sep === -1) return null;

  const role = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!role || !id) return null;

  return { role, id };
}

module.exports = { setAuthCookies, clearAuthCookies, readAuthCookie };
