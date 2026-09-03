import { doctorModel } from '../models/doctorModel.js';
import { appointmentModel } from '../models/appointmentModel.js';
import { patientModel } from '../models/patientModel.js';
import { slotModel } from '../models/slotModel.js';
import { hospitalModel } from '../models/hospitalModel.js';
import { doctorService } from '../models/doctorModel.js';
import { appointmentService } from '../models/appointmentModel.js';
import { patientService } from '../models/patientModel.js';
import { slotService } from '../models/slotModel.js';
import { hospitalService } from '../models/hospitalModel.js';

export const renderDashboard = async (req, res) => {
  try {
    const perf = await doctorService.getDoctorPerformance(req.doctor.doctor_id);
    
    // Dashboard is a global overview, so reset the active hospital
    doctorService.setActiveHospital(req.doctor.doctor_id, null);
    res.locals.currentHospital = null;
    
    let rawSlots = await slotService.getSlotsByDoctor(req.doctor.doctor_id);
    const activeHospitalId = doctorService.getActiveHospital();
    if (activeHospitalId) {
      rawSlots = rawSlots.filter(s => s.hospitalId === activeHospitalId);
    }

    // Resolve hospital names for each slot
    const todaySlots = await Promise.all(rawSlots.map(async slot => {
      const hospital = await hospitalService.getHospitalById(slot.hospitalId);
      return { ...slot, hospital };
    }));

    // Gather appointments for all filtered slots today
    let todayAppointments = [];
    for (const slot of rawSlots) {
      const slotApts = await appointmentService.getAppointmentsBySlot(slot.id);
      todayAppointments.push(...slotApts);
    }

    const completedCount = todayAppointments.filter(a => a.status === 'COMPLETED').length;
    const waitingCount = todayAppointments.filter(a => a.status === 'WAITING').length;

    // Fetch hospital statuses for the offline banner
    const hospitals = await hospitalService.getHospitalsForDoctor(req.doctor.doctor_id);
    const offlineHospitals = hospitals.filter(h => h.enrollmentStatus !== 'ACTIVE');

    res.render('pages/dashboard', { 
      title: 'Trividha - Dashboard',
      headerTitle: 'Dashboard',
      performance: perf,
      todaySlots,
      todayCount: todayAppointments.length,
      completedCount,
      waitingCount,
      offlineHospitals,
      leavesTaken: req.doctor.leavesTaken,
      leaveRequests: req.doctor.leaveRequests
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

export const updateStatus = (req, res) => {
  const { status } = req.body;
  if (status) {
    doctorService.updateStatus(req.doctor.doctor_id, status);
  }
  res.redirect('/');
};

export const submitLeave = async (req, res) => {
  const { reason, fromDate, toDate } = req.body;
  if (reason && fromDate && toDate) {
    await doctorService.addLeaveRequest(req.doctor.doctor_id, reason, fromDate, toDate);
  }
  res.redirect('/');
};

export const updateHospitalStatus = async (req, res) => {
  const { doctor_hospital_id, status } = req.body;
  if (doctor_hospital_id && status) {
    await hospitalService.updateHospitalStatus(doctor_hospital_id, status);
  }
  res.redirect(req.get('Referer') || '/hospitals');
};

export const submitHospitalLeave = async (req, res) => {
  const { doctor_hospital_id, reason, fromDate, toDate } = req.body;
  // 1. Set hospital status to ON_LEAVE
  if (doctor_hospital_id) {
    await hospitalService.updateHospitalStatus(doctor_hospital_id, 'ON_LEAVE');
  }
  // 2. Also record it in doctor_leave table
  if (reason && fromDate && toDate) {
    await doctorService.addLeaveRequest(req.doctor.doctor_id, reason, fromDate, toDate);
  }
  res.redirect(req.get('Referer') || '/hospitals');
};

export const renderProfile = async (req, res) => {
  const hospitals = await hospitalService.getHospitalsForDoctor(req.doctor.doctor_id);
  res.render('pages/profile', {
    title: 'My Profile',
    headerTitle: 'Doctor Profile',
    hospitals
  });
};

export const updateProfile = async (req, res) => {
  const { bio, specialization } = req.body;
  const profile_photo = req.file ? req.file.path : null; // Cloudinary URL
  
  if (bio || specialization || profile_photo) {
    const updateData = {};
    if (bio) updateData.bio = bio;
    if (specialization) updateData.specialization = specialization;
    if (profile_photo) updateData.profile_photo = profile_photo;

    const { error } = await supabase
      .from('doctor')
      .update(updateData)
      .eq('doctor_id', req.doctor.doctor_id);
      
    if (error) console.error("Error updating profile:", error);
  }
  
  res.redirect('/profile');
};
