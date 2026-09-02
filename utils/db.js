const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const dotenv = require("dotenv");

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres.qoujawkbwwfqlaechcnx:u8KOsTS7F5kVxnyA@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

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

// Test and verify connection to Supabase
pool
  .query("SELECT current_database(), current_user, version();")
  .then((res) => {
    console.log(
      `Connected to Supabase PostgreSQL [DB: ${res.rows[0].current_database}, User: ${res.rows[0].current_user}]`
    );
  })
  .catch((err) => {
    console.error("Failed to connect to Supabase PostgreSQL:", err.message || err);
  });

module.exports = {
  pool,
  query,
  TRANSCRIPTS_DIR,
};


