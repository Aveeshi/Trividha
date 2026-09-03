const pool = require('./db');

function publicHospital(h) {
  if (!h) return null;
  return {
    id: h.hospital_id,
    hospital_id: h.hospital_id,
    name: h.name,
    email: h.login_email,
    login_email: h.login_email,
    address: h.address,
    city: h.city,
    state: h.state,
    pincode: h.pincode,
    phone: h.phone,
    hospital_type: h.hospital_type,
    ayush: !!h.ayush_mode_enabled,
    ayush_mode_enabled: !!h.ayush_mode_enabled,
    status: h.status
  };
}

const HospitalModel = {
  publicHospital,

  async findByEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM hospital WHERE login_email = $1',
      [String(email).toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM hospital WHERE hospital_id = $1', [id]);
    return rows[0] || null;
  },

  async create({ name, email, passwordHash, hospitalType, address, city, state, pincode, phone }) {
    const { rows } = await pool.query(
      `INSERT INTO hospital (name, login_email, password_hash, hospital_type, address, city, state, pincode, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        name.trim(), email.toLowerCase().trim(), passwordHash,
        hospitalType || 'OTHER', address || null, city || null,
        state || null, pincode || null, phone || null
      ]
    );
    return rows[0];
  },

  async updateProfile(id, { name, address, city, state, pincode, phone, ayushModeEnabled, ayush }) {
    const ayushVal = ayush !== undefined ? !!ayush : !!ayushModeEnabled;
    await pool.query(
      `UPDATE hospital
       SET name = $1, address = $2, city = $3, state = $4, pincode = $5, phone = $6,
           ayush_mode_enabled = $7, updated_at = now()
       WHERE hospital_id = $8`,
      [name, address || '', city || '', state || '', pincode || '', phone || '', ayushVal, id]
    );
    return this.findById(id);
  },

  async updatePassword(id, passwordHash) {
    await pool.query(
      'UPDATE hospital SET password_hash = $1, updated_at = now() WHERE hospital_id = $2',
      [passwordHash, id]
    );
  },

  async setResetOtp(id, otp, expiresIso) {
    await pool.query(
      'UPDATE hospital SET reset_otp = $1, reset_otp_expires = $2 WHERE hospital_id = $3',
      [otp, expiresIso, id]
    );
  },

  async clearResetOtp(id) {
    await pool.query('UPDATE hospital SET reset_otp = NULL, reset_otp_expires = NULL WHERE hospital_id = $1', [id]);
  }
};

module.exports = HospitalModel;
