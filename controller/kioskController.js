const KioskModel = require('../model/kioskModel');
const HospitalModel = require('../model/hospitalModel');
const pool = require('../model/db');

exports.list = async (req, res) => {
  try {
    const kiosks = await KioskModel.listByHospital(req.hospitalId);
    res.json({ kiosks });
  } catch (err) {
    console.error('Kiosk list error:', err);
    res.status(500).json({ error: 'Could not load kiosks.' });
  }
};

exports.create = async (req, res) => {
  try {
    const count = Math.max(1, Math.min(50, Number(req.body.count) || 1));
    const location = (req.body.location || '').trim();
    const kiosks = await KioskModel.createBatch(req.hospitalId, count, location);
    res.json({ kiosks });
  } catch (err) {
    console.error('Kiosk create error:', err);
    res.status(500).json({ error: 'Could not create kiosks.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const existing = await KioskModel.findById(req.params.id, req.hospitalId);
    if (!existing) return res.status(404).json({ error: 'Kiosk not found.' });
    await KioskModel.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Kiosk remove error:', err);
    res.status(500).json({ error: 'Could not remove this kiosk.' });
  }
};

exports.publicFeed = async (req, res) => {
  try {
    const { hospitalId, kioskNumber } = req.params;

    const kiosk = await KioskModel.findByNumber(hospitalId, kioskNumber);
    if (!kiosk) {
      return res.status(404).json({ error: 'Unknown kiosk. Ask the hospital manager to register this kiosk number.' });
    }

    const hospital = await HospitalModel.findById(hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

    const { rows: doctors } = await pool.query(
      `SELECT d.doctor_id, d.name, d.specialization, dh.department, dh.specialization_at_hospital
       FROM doctor d
       JOIN doctor_hospital dh ON dh.doctor_id = d.doctor_id
       WHERE dh.hospital_id = $1 AND dh.enrollment_status = 'ACTIVE'
       ORDER BY d.name`,
      [hospitalId]
    );

    res.json({
      hospital: { name: hospital.name, ayush: !!hospital.ayush_mode_enabled },
      kiosk: { number: kiosk.kiosk_number, location: kiosk.location_description },
      doctors
    });
  } catch (err) {
    console.error('Kiosk public feed error:', err);
    res.status(500).json({ error: 'Could not load kiosk feed.' });
  }
};
