/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — doctor model
 * Column names match the DB exactly: government_doctor_id, login_email,
 * password_hash, name, specialization, qualification, experience_years.
 * ========================================================================== */

const bcrypt = require('bcryptjs');
const pool = require('./db');

async function findByEmail(login_email) {
  const { rows } = await pool.query(
    'SELECT * FROM doctor WHERE login_email = $1',
    [login_email]
  );
  return rows[0] || null;
}

async function findByGovId(government_doctor_id) {
  const { rows } = await pool.query(
    'SELECT * FROM doctor WHERE government_doctor_id = $1',
    [government_doctor_id]
  );
  return rows[0] || null;
}

async function findById(doctor_id) {
  const { rows } = await pool.query(
    'SELECT * FROM doctor WHERE doctor_id = $1',
    [doctor_id]
  );
  return rows[0] || null;
}

async function create({
  government_doctor_id,
  login_email,
  password,
  name,
  specialization,
  qualification,
  experience_years,
}) {
  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO doctor
       (government_doctor_id, login_email, password_hash, name, specialization, qualification, experience_years)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      government_doctor_id,
      login_email,
      password_hash,
      name,
      specialization || null,
      qualification || null,
      experience_years || null,
    ]
  );
  return rows[0];
}

function verifyPassword(doctor, password) {
  return bcrypt.compare(password, doctor.password_hash);
}

module.exports = { findByEmail, findByGovId, findById, create, verifyPassword };
