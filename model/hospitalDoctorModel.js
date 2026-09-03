const pool = require('./db');

function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.doctor_id,
    doctor_id: row.doctor_id,
    gov_id: row.government_doctor_id,
    government_doctor_id: row.government_doctor_id,
    name: row.name,
    specialization: row.specialization_at_hospital || row.specialization || 'General Medicine',
    department: row.department,
    status: row.enrollment_status === 'ACTIVE' ? 'Available' : 'On Leave',
    rating: 4.8,
    patients_seen: 0,
    slots: ['09:00-13:00', '14:00-18:00'],
    leaves_allotted: 12,
    leaves_used: 0,
    review: ''
  };
}

const DoctorModel = {
  serialize,

  async listByHospital(hospitalId) {
    const { rows } = await pool.query(
      `SELECT d.*, dh.doctor_hospital_id, dh.department, dh.specialization_at_hospital,
              dh.enrollment_status, dh.joining_date, dh.leaving_date
       FROM doctor d
       JOIN doctor_hospital dh ON dh.doctor_id = d.doctor_id
       WHERE dh.hospital_id = $1 AND dh.enrollment_status = 'ACTIVE'
       ORDER BY d.name`,
      [hospitalId]
    );
    return rows.map(serialize);
  },

  async findById(doctorId, hospitalId) {
    const { rows } = await pool.query(
      `SELECT d.*, dh.doctor_hospital_id, dh.department, dh.specialization_at_hospital,
              dh.enrollment_status, dh.joining_date, dh.leaving_date
       FROM doctor d
       JOIN doctor_hospital dh ON dh.doctor_id = d.doctor_id
       WHERE d.doctor_id = $1 AND dh.hospital_id = $2`,
      [doctorId, hospitalId]
    );
    return serialize(rows[0]);
  },

  async findByGovId(hospitalId, govId, excludeDoctorId = null) {
    const params = [hospitalId, govId];
    let excludeClause = '';
    if (excludeDoctorId) {
      params.push(excludeDoctorId);
      excludeClause = 'AND d.doctor_id != $3';
    }
    const { rows } = await pool.query(
      `SELECT d.doctor_id FROM doctor d
       JOIN doctor_hospital dh ON dh.doctor_id = d.doctor_id
       WHERE dh.hospital_id = $1 AND d.government_doctor_id = $2 ${excludeClause}`,
      params
    );
    return rows[0] || null;
  },

  async create(hospitalId, fields) {
    const { gov_id, department, specializationAtHospital, joiningDate } = fields;

    const { rows: doctorRows } = await pool.query(
      'SELECT doctor_id FROM doctor WHERE government_doctor_id = $1',
      [String(gov_id).trim()]
    );
    if (!doctorRows[0]) {
      const err = new Error(
        `No doctor is registered with government ID "${gov_id}" yet. They need to sign up on the Doctor Portal before a hospital can enroll them.`
      );
      err.code = 'DOCTOR_NOT_FOUND';
      throw err;
    }
    const doctorId = doctorRows[0].doctor_id;

    await pool.query(
      `INSERT INTO doctor_hospital (doctor_id, hospital_id, department, specialization_at_hospital, joining_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (doctor_id, hospital_id)
       DO UPDATE SET enrollment_status = 'ACTIVE', leaving_date = NULL, updated_at = now()`,
      [doctorId, hospitalId, department || null, specializationAtHospital || null, joiningDate || new Date()]
    );

    return this.findById(doctorId, hospitalId);
  },

  async update(doctorId, hospitalId, fields) {
    const { department, specializationAtHospital, joiningDate, leavingDate, enrollmentStatus } = fields;
    await pool.query(
      `UPDATE doctor_hospital
       SET department = $1, specialization_at_hospital = $2, joining_date = $3,
           leaving_date = $4, enrollment_status = $5, updated_at = now()
       WHERE doctor_id = $6 AND hospital_id = $7`,
      [
        department || null, specializationAtHospital || null, joiningDate || null,
        leavingDate || null, enrollmentStatus || 'ACTIVE', doctorId, hospitalId
      ]
    );
    return this.findById(doctorId, hospitalId);
  },

  async remove(doctorId, hospitalId) {
    await pool.query(
      `UPDATE doctor_hospital SET enrollment_status = 'INACTIVE', leaving_date = CURRENT_DATE, updated_at = now()
       WHERE doctor_id = $1 AND hospital_id = $2`,
      [doctorId, hospitalId]
    );
  },

  async importRows(hospitalId, rows, fileReference = 'MANUAL_UPLOAD') {
    const client = await pool.connect();
    let imported = 0;
    const skipped = [];
    try {
      await client.query('BEGIN');

      const { rows: uploadRows } = await client.query(
        `INSERT INTO doctor_roster_upload (hospital_id, file_reference, processing_status)
         VALUES ($1, $2, 'PROCESSING') RETURNING roster_upload_id`,
        [hospitalId, fileReference]
      );
      const rosterUploadId = uploadRows[0].roster_upload_id;

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const govId = String(row.gov_id || row['Gov ID'] || '').trim();
        const name = String(row.name || row['Doctor Name'] || '').trim();
        const email = row.email || row['Email'] || null;
        const excelRow = idx + 2;

        if (!govId || !name) { skipped.push(excelRow); continue; }

        const { rows: matchRows } = await client.query(
          'SELECT doctor_id FROM doctor WHERE government_doctor_id = $1',
          [govId]
        );
        const matchedDoctorId = matchRows[0] ? matchRows[0].doctor_id : null;

        await client.query(
          `INSERT INTO doctor_roster_entry
             (roster_upload_id, government_doctor_id, doctor_name, doctor_email, matched_doctor_id, error_message)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            rosterUploadId, govId, name, email, matchedDoctorId,
            matchedDoctorId ? null : 'No registered doctor with this government ID yet'
          ]
        );

        if (matchedDoctorId) {
          await client.query(
            `INSERT INTO doctor_hospital (doctor_id, hospital_id, joining_date)
             VALUES ($1, $2, CURRENT_DATE)
             ON CONFLICT (doctor_id, hospital_id)
             DO UPDATE SET enrollment_status = 'ACTIVE', leaving_date = NULL, updated_at = now()`,
            [matchedDoctorId, hospitalId]
          );
          imported++;
        } else {
          skipped.push(excelRow);
        }
      }

      await client.query(
        `UPDATE doctor_roster_upload SET processing_status = 'COMPLETED', processed_at = now(), error_count = $1
         WHERE roster_upload_id = $2`,
        [skipped.length, rosterUploadId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { imported, skipped, doctors: await this.listByHospital(hospitalId) };
  }
};

module.exports = DoctorModel;
