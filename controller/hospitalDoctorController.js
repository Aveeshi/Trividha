const XLSX = require('xlsx');
const DoctorModel = require('../model/hospitalDoctorModel');

exports.list = async (req, res) => {
  try {
    const doctors = await DoctorModel.listByHospital(req.hospitalId);
    res.json({ doctors });
  } catch (err) {
    console.error('Doctor list error:', err);
    res.status(500).json({ error: 'Could not load doctors.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { gov_id, department, specializationAtHospital, joiningDate, specialization, name } = req.body;
    const effectiveGovId = gov_id || req.body.government_doctor_id;
    if (!effectiveGovId || !String(effectiveGovId).trim()) {
      return res.status(400).json({ error: "Doctor's government ID is required." });
    }

    const existing = await DoctorModel.findByGovId(req.hospitalId, String(effectiveGovId).trim());
    if (existing) {
      return res.status(409).json({ error: 'A doctor with this government ID is already enrolled here.' });
    }

    const doctor = await DoctorModel.create(req.hospitalId, {
      gov_id: String(effectiveGovId).trim(),
      department: department || null,
      specializationAtHospital: specializationAtHospital || specialization || null,
      joiningDate: joiningDate || null
    });
    res.json({ doctor });
  } catch (err) {
    if (err.code === 'DOCTOR_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Doctor create error:', err);
    res.status(500).json({ error: 'Could not add this doctor.' });
  }
};

exports.update = async (req, res) => {
  try {
    const existing = await DoctorModel.findById(req.params.id, req.hospitalId);
    if (!existing) return res.status(404).json({ error: 'Doctor not found.' });

    const { department, specializationAtHospital, specialization, joiningDate, leavingDate, enrollmentStatus } = req.body;
    const doctor = await DoctorModel.update(req.params.id, req.hospitalId, {
      department,
      specializationAtHospital: specializationAtHospital || specialization,
      joiningDate,
      leavingDate,
      enrollmentStatus
    });
    res.json({ doctor });
  } catch (err) {
    console.error('Doctor update error:', err);
    res.status(500).json({ error: 'Could not update this doctor.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const existing = await DoctorModel.findById(req.params.id, req.hospitalId);
    if (!existing) return res.status(404).json({ error: 'Doctor not found.' });
    await DoctorModel.remove(req.params.id, req.hospitalId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Doctor remove error:', err);
    res.status(500).json({ error: 'Could not remove this doctor.' });
  }
};

exports.import = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose an Excel file to upload.' });

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (e) {
      return res.status(400).json({ error: 'Could not read that file. Please upload a valid .xlsx or .xls file.' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'That sheet looks empty. Add doctor rows and try again.' });
    }

    const { imported, skipped, doctors } = await DoctorModel.importRows(req.hospitalId, rows, req.file.originalname);
    res.json({ imported, skipped, total: doctors.length, doctors });
  } catch (err) {
    console.error('Doctor import error:', err);
    res.status(500).json({ error: 'Could not process that file.' });
  }
};

exports.template = (req, res) => {
  const sample = [
    { 'Gov ID': 'DOC-2026-0001', 'Doctor Name': 'Dr. Ananya Kulkarni' },
    { 'Gov ID': 'DOC-2026-0002', 'Doctor Name': 'Dr. Priya Nair' }
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Doctors');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="trividha-doctor-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};
