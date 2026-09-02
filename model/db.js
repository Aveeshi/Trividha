/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — shared Postgres connection pool
 * All models query through this single pool (see DB_CONNECTION in .env).
 * ========================================================================== */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
