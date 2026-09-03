const path = require("path");
const fs = require("fs");
// Same Postgres instance as the rest of the app (DB_CONNECTION) — reuse the
// shared pool from model/db.js instead of opening a second connection to it.
const pool = require("../model/db");

const DATA_DIR = path.join(__dirname, "..", "data");
const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

// Helper query function
const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
  TRANSCRIPTS_DIR,
};


