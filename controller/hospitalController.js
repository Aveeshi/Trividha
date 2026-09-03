const HospitalModel = require('../model/hospitalModel');
const DoctorModel = require('../model/hospitalDoctorModel');
const KioskModel = require('../model/kioskModel');

exports.updateProfile = async (req, res) => {
  try {
    const { name, address, city, state, pincode, phone, ayushModeEnabled, ayush } = req.body;
    const hospital = await HospitalModel.updateProfile(req.hospitalId, {
      name, address, city, state, pincode, phone, ayushModeEnabled, ayush
    });
    res.json({ hospital: HospitalModel.publicHospital(hospital) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Could not update hospital profile.' });
  }
};

exports.sync = async (req, res) => {
  try {
    const [doctors, kiosks] = await Promise.all([
      DoctorModel.listByHospital(req.hospitalId),
      KioskModel.listByHospital(req.hospitalId)
    ]);
    res.json({
      doctorCount: doctors.length,
      kioskCount: kiosks.length,
      last_synced_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Could not sync.' });
  }
};
