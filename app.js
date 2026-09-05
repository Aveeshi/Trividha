const path = require('path');
const express = require('express');
require('dotenv').config();

const session = require('express-session');
const cookieParser = require('cookie-parser');

const authRouter = require('./routes/authRouter');
const hospitalAuthRouter = require('./routes/hospitalAuthRouter');
const hospitalRouter = require('./routes/hospitalRouter');
const hospitalDoctorRouter = require('./routes/hospitalDoctorRouter');
const kioskRouter = require('./routes/kioskRouter');
const analyticsRouter = require('./routes/analyticsRouter');
const kioskController = require('./controller/kioskController');
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

/* ---------------- Hospital API routes ---------------- */
app.use('/api/auth', hospitalAuthRouter);
app.use('/api/hospital', hospitalRouter);
app.use('/api/doctors', hospitalDoctorRouter);
app.use('/api/kiosks', kioskRouter);
app.use('/api/analytics', analyticsRouter);
app.get('/api/kiosk-feed/:hospitalId/:kioskNumber', kioskController.publicFeed);

/* ---------------- Hospital Page routes ---------------- */
app.get('/login', (req, res) => res.render('hospital/auth/login'));
app.get('/dashboard', (req, res) => res.render('hospital/dashboard/home'));
app.get('/hospital/login', (req, res) => res.render('hospital/auth/login'));
app.get('/hospital/dashboard', (req, res) => res.render('hospital/dashboard/home'));

app.get('/', (req, res) => {
  // Explicit "change language" intent always wins, even for a logged-in user.
  if (req.query.change === '1') {
    return res.render('index');
  }

  // NOTE: the full app redirects an already-logged-in patient/doctor
  // straight to their dashboard here. That dashboard/portal code isn't
  // part of this landing-page + auth extract, so that redirect logic has
  // been left out — this always shows the language-select screen.

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Trividha kiosk running at http://localhost:${PORT}`);
});
