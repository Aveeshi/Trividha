const pool = require('./db');

const AnalyticsModel = {
  async dailySeries(hospitalId, days) {
    const { rows: doctors } = await pool.query(
      `SELECT DISTINCT d.doctor_id, d.name
       FROM doctor d
       JOIN doctor_hospital dh ON dh.doctor_id = d.doctor_id
       WHERE dh.hospital_id = $1 AND dh.enrollment_status = 'ACTIVE'
       ORDER BY d.name`,
      [hospitalId]
    );

    const dates = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const { rows } = await pool.query(
      `SELECT doctor_id, DATE(consultation_end_time) AS visit_date, COUNT(*)::int AS count
       FROM appointment
       WHERE hospital_id = $1 AND appointment_status = 'COMPLETED'
         AND consultation_end_time >= $2
       GROUP BY doctor_id, DATE(consultation_end_time)`,
      [hospitalId, dates[0]]
    );

    const byDoctorAndDate = {};
    rows.forEach(r => {
      const dateStr = r.visit_date instanceof Date
        ? r.visit_date.toISOString().slice(0, 10)
        : r.visit_date;
      byDoctorAndDate[`${r.doctor_id}|${dateStr}`] = r.count;
    });

    const series = doctors.map(doc => ({
      doctor_id: doc.doctor_id,
      name: doc.name,
      counts: dates.map(date => byDoctorAndDate[`${doc.doctor_id}|${date}`] || 0)
    }));

    return { dates, series };
  },

  async recentVisits(hospitalId, days) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceStr = since.toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT a.appointment_id, a.doctor_id, d.name AS doctor_name,
              DATE(a.consultation_end_time) AS visit_date, a.appointment_status
       FROM appointment a
       JOIN doctor d ON d.doctor_id = a.doctor_id
       WHERE a.hospital_id = $1 AND a.appointment_status = 'COMPLETED'
         AND a.consultation_end_time >= $2
       ORDER BY a.consultation_end_time DESC`,
      [hospitalId, sinceStr]
    );
    return rows;
  },

  async findDoctor(doctorId, hospitalId) {
    const { rows } = await pool.query(
      `SELECT d.doctor_id FROM doctor d
       JOIN doctor_hospital dh ON dh.doctor_id = d.doctor_id
       WHERE d.doctor_id = $1 AND dh.hospital_id = $2`,
      [doctorId, hospitalId]
    );
    return rows[0] || null;
  }
};

module.exports = AnalyticsModel;
