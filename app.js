// Trividha Multilingual Healthcare Kiosk & Booking MVC Application
// Entry Point, Middleware, i18n Session & View Engine

const express = require("express");
const path = require("path");
const homeRouter = require("./router/homeRouter");
const { getTranslation } = require("./model/translations");
const { ALL_LANGUAGES } = require("./model/languages");
const apiRouter = require("./router/apiRouter");
const dotenv = require("dotenv");

// Load .env from current directory first, then fallback to parent if needed
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });


const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS view engine and directory
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, "public")));

// i18n & Global context middleware
app.use((req, res, next) => {
  const lang = req.query.lang || "en";
  res.locals.selectedLang = lang;
  res.locals.currentLang = ALL_LANGUAGES.find((l) => l.code === lang) || ALL_LANGUAGES[22];
  res.locals.dict = getTranslation(lang);
  res.locals.languages = ALL_LANGUAGES;
  next();
});

// Mount routes
app.use("/api", apiRouter);
app.use("/", homeRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", {
    selectedLang: req.query.lang || "en",
    pageTitle: "404 · Page Not Found"
  });
});

// Start standalone server if run directly
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`त्रिविधा (Trividha) Kiosk MVC server running at http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
