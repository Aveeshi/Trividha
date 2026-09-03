const pool = require('./db');

function generateKioskCode(hospitalId, kioskNumber) {
  return `H${hospitalId}-K${String(kioskNumber).padStart(3, '0')}`;
}

function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.kiosk_id,
    kiosk_id: row.kiosk_id,
    kiosk_number: row.kiosk_number,
    kiosk_code: row.kiosk_code,
    location: row.location_description,
    location_description: row.location_description
  };
}

const KioskModel = {
  serialize,

  async listByHospital(hospitalId) {
    const { rows } = await pool.query(
      'SELECT * FROM kiosk WHERE hospital_id = $1 ORDER BY kiosk_number',
      [hospitalId]
    );
    return rows.map(serialize);
  },

  async findById(id, hospitalId) {
    const { rows } = await pool.query(
      'SELECT * FROM kiosk WHERE kiosk_id = $1 AND hospital_id = $2',
      [id, hospitalId]
    );
    return serialize(rows[0]);
  },

  async findByNumber(hospitalId, kioskNumber) {
    const { rows } = await pool.query(
      'SELECT * FROM kiosk WHERE hospital_id = $1 AND kiosk_number = $2',
      [hospitalId, kioskNumber]
    );
    return serialize(rows[0]);
  },

  async createBatch(hospitalId, count, locationDescription) {
    const client = await pool.connect();
    const created = [];
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'SELECT COALESCE(MAX(kiosk_number), 0) AS max_number FROM kiosk WHERE hospital_id = $1',
        [hospitalId]
      );
      let nextNumber = rows[0].max_number + 1;

      for (let i = 0; i < count; i++) {
        const kioskNumber = nextNumber++;
        const kioskCode = generateKioskCode(hospitalId, kioskNumber);
        const { rows: inserted } = await client.query(
          `INSERT INTO kiosk (hospital_id, kiosk_code, kiosk_number, location_description)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [hospitalId, kioskCode, kioskNumber, locationDescription || null]
        );
        created.push(serialize(inserted[0]));
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return created;
  },

  async remove(id) {
    await pool.query('DELETE FROM kiosk WHERE kiosk_id = $1', [id]);
  }
};

module.exports = KioskModel;
