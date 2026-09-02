const path = require('path');
const express = require('express');
require('dotenv').config();

const { v4: uuid } = require('uuid');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const authRouter = require('./routes/authRouter');
const patientRouter = require('./routes/patientRouter');
const doctorRouter = require('./routes/doctorRouter');
const { readAuthCookie } = require('./utils/authCookies');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'trividha-dev-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true, // sliding expiry: 30 days from the visitor's most recent visit, not just from login
    cookie: {
      maxAge: THIRTY_DAYS_MS,
      httpOnly: true,
      sameSite: 'lax',
    },
    // NOTE: default MemoryStore only — fine for dev, but sessions are lost on
    // server restart and it won't scale past one process. Swap in
    // connect-pg-simple (already a dependency) for a persistent store before
    // going to production.
  })
);

app.get('/', (req, res) => {
  // Explicit "change language" intent always wins, even for a logged-in user.
  if (req.query.change === '1') {
    return res.render('index');
  }

  // Already logged in (session, or the isLoggedIn/userLoggedIn cookies
  // surviving a server restart)? Skip straight to their dashboard instead of
  // showing the role-select/login screen again. The dashboard route guard
  // (ensurePatient/ensureDoctor) still re-verifies the id against the DB, so
  // a stale/tampered cookie just falls through to the login page there.
  if (req.session.patientId) {
    return res.redirect('/patient/dashboard');
  }
  if (req.session.doctorId) {
    return res.redirect('/doctor/dashboard');
  }

  const cookieAuth = readAuthCookie(req);
  if (cookieAuth && (cookieAuth.role === 'patient' || cookieAuth.role === 'doctor')) {
    return res.redirect(`/${cookieAuth.role}/dashboard`);
  }

  res.render('index');
});

app.get('/home', (req, res) => {
  res.render('home');
});

app.use('/', authRouter);
app.use('/patient', patientRouter);
app.use('/doctor', doctorRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Trividha kiosk running at http://localhost:${PORT}`);
});
