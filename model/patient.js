/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — patient model
 * Thin query layer over the `patient` table. Column names match the DB
 * exactly (see information_schema): aadhaar_number, abha_id, first_name,
 * last_name, email, phone_number, gender, date_of_birth.
 * ========================================================================== */

const pool = require('./db');

async function findByAadhaar(aadhaar_number) {
  const { rows } = await pool.query(
    'SELECT * FROM patient WHERE aadhaar_number = $1',
    [aadhaar_number]
  );
  return rows[0] || null;
}

async function findByAbha(abha_id) {
  const { rows } = await pool.query(
    'SELECT * FROM patient WHERE abha_id = $1',
    [abha_id]
  );
  return rows[0] || null;
}

async function findById(patient_id) {
  const { rows } = await pool.query(
    'SELECT * FROM patient WHERE patient_id = $1',
    [patient_id]
  );
  return rows[0] || null;
}

async function create({
  aadhaar_number,
  abha_id,
  first_name,
  last_name,
  email,
  phone_number,
  gender,
  date_of_birth,
}) {
  const { rows } = await pool.query(
    `INSERT INTO patient
       (aadhaar_number, abha_id, first_name, last_name, email, phone_number, gender, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [aadhaar_number, abha_id || null, first_name, last_name, email || null, phone_number, gender || null, date_of_birth]
  );
  return rows[0];
}

module.exports = { findByAadhaar, findByAbha, findById, create };
