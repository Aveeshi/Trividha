import { hospitalModel, hospitalService } from '../models/hospitalModel.js';
import { slotModel, slotService } from '../models/slotModel.js';
import { doctorModel, doctorService } from '../models/doctorModel.js';

export const listHospitals = async (req, res) => {
  try {
    const hospitals = await hospitalService.getHospitalsForDoctor(req.doctor.doctor_id);
    res.render('pages/hospitals', {
      title: 'Trividha - My Hospitals',
      headerTitle: 'My Hospitals',
      hospitals
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

export const viewHospitalSlots = async (req, res) => {
  try {
    const hospital = await hospitalService.getHospitalById(req.params.id);
    if (!hospital) return res.redirect('/hospitals');
    
    // Set this hospital as the active one for the doctor
    doctorService.setActiveHospital(req.doctor.doctor_id, hospital.id);
    res.locals.currentHospital = hospital;

    // Get this doctor's enrollment record for this hospital (for status toggle)
    const allHospitals = await hospitalService.getHospitalsForDoctor(req.doctor.doctor_id);
    const doctorHospital = allHospitals.find(h => String(h.id) === String(req.params.id));
    
    const slots = await slotService.getSlotsByDoctorAndHospital(req.doctor.doctor_id, hospital.id);
    res.render('pages/slots', {
      title: `Trividha - Today's Slots`,
      headerTitle: `Slots at ${hospital.name}`,
      hospital,
      slots,
      doctorHospitalId: doctorHospital ? doctorHospital.doctorHospitalId : null,
      enrollmentStatus: doctorHospital ? doctorHospital.enrollmentStatus : 'ACTIVE'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.stack);
  }
};
