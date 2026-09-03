import { appointmentModel, appointmentService } from '../models/appointmentModel.js';
import { patientModel, patientService } from '../models/patientModel.js';
import { supabase } from '../config/supabase.js';
import crypto from 'crypto';

export const savePrescription = async (req, res) => {
  const { items, aptId } = req.body;
  
  if (!items || !items.length || !aptId) {
    return res.status(400).json({ error: 'No items or aptId provided' });
  }

  try {
    // 1. Fetch the appointment to get patient_id and hospital_id
    const { data: aptData, error: aptError } = await supabase
      .from('appointment')
      .select('patient_id, hospital_id')
      .eq('appointment_id', aptId)
      .single();
      
    if (aptError || !aptData) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // 2. Insert into prescription
    const { data: presData, error: presError } = await supabase
      .from('prescription')
      .insert({
        patient_id: aptData.patient_id,
        doctor_id: req.doctor.doctor_id,
        hospital_id: aptData.hospital_id,
        appointment_id: aptId,
        status: 'ISSUED'
      })
      .select('prescription_id')
      .single();

    if (presError || !presData) {
      console.error('Prescription insert error:', presError);
      return res.status(500).json({ error: 'Database error' });
    }

    // 3. Insert into prescription_item
    const insertData = items.map(item => ({
      prescription_id: presData.prescription_id,
      medicine_name: item.medicine_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      disease_name: item.disease_name,
      instructions: item.instructions
    }));

    const { data: itemData, error: itemError } = await supabase
      .from('prescription_item')
      .insert(insertData);

    if (itemError) {
      console.error('Prescription item error:', itemError);
      return res.status(500).json({ error: 'Database error' });
    }

    // 4. Update the appointment status to COMPLETED
    await supabase.from('appointment').update({ appointment_status: 'COMPLETED' }).eq('appointment_id', aptId);
    
    // 5. Update the queue_entry to COMPLETED
    await supabase.from('queue_entry').update({ queue_status: 'COMPLETED' }).eq('appointment_id', aptId);
    
    // Also update the appointment status to COMPLETED
    await supabase.from('appointment').update({ appointment_status: 'COMPLETED' }).eq('appointment_id', aptId);

    res.status(200).json({ success: true, data: itemData, prescription_id: presData.prescription_id });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const renderConsultation = async (req, res) => {
  try {
    const filter = req.query.filter || 'all'; 
    
    // Fetch completed appointments for this doctor
    const { data: appointments, error } = await supabase
      .from('appointment')
      .select('*, patient(*), hospital(*), prescription(*, prescription_item(*))')
      .eq('doctor_id', req.doctor.doctor_id)
      .eq('appointment_status', 'COMPLETED')
      .order('booking_time', { ascending: false });

    if (error) throw error;

    // Map them to the view format
    const history = await Promise.all(appointments.map(async apt => {
      const p = apt.patient;
      
      // Get the latest prescription if multiple
      const pres = apt.prescription && apt.prescription.length > 0 
        ? apt.prescription[apt.prescription.length - 1] 
        : null;
        
      let meds = [];
      let diagnosis = 'None';
      if (pres && pres.prescription_item) {
        meds = pres.prescription_item.map(i => `${i.medicine_name} ${i.dosage} (${i.frequency}) x ${i.duration}`);
        const firstDisease = pres.prescription_item.find(i => i.disease_name);
        if (firstDisease) diagnosis = firstDisease.disease_name;
      }

      // Generate a fallback summary from prescription data
      let defaultSummary = 'No summary available.';
      if (pres) {
        defaultSummary = `Patient was seen for ${diagnosis !== 'None' ? diagnosis : 'general consultation'}.`;
        if (meds.length > 0) {
           defaultSummary += `\nPrescribed Medications: ${meds.join(', ')}`;
        }
      }

      // Map to frontend expectation
      const mappedPatient = {
        name: p.first_name + ' ' + p.last_name,
        age: p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 30,
        abhaId: p.abha_id,
        gender: p.gender
      };

      const timeline = await patientService.getMedicalTimeline(p.patient_id) || [];
      
      return {
        patient: mappedPatient,
        date: new Date(apt.booking_time).toLocaleDateString(),
        slot: 'Morning 09:00 - 12:00', // Mocking slot time for now
        hospital: apt.hospital.name,
        prescription: {
          diagnosis: diagnosis,
          medicines: meds,
          labs: [] // No lab table yet
        },
        timeline: timeline,
        fullSummary: pres ? pres.doctor_notes || defaultSummary : defaultSummary
      };
    }));

    res.render('pages/consultation', {
      title: 'Consultations History',
      headerTitle: 'Consultations History',
      history,
      filter
    });
  } catch(err) {
    console.error('Consultation error:', err);
    res.status(500).send("Server Error");
  }
};

export const renderWorkspace = async (req, res) => {
  try {
    const aptId = req.query.aptId;
    if (!aptId) return res.redirect('/queue');
    
    const apt = await appointmentService.getAppointmentById(aptId);
    if (!apt) return res.redirect('/queue');
    
    const patient = await patientService.getPatientById(apt.patientId);
    if (!patient) return res.redirect('/queue');
    
    const aiSummary = await patientService.getAISummary(patient.id);
    const timeline = await patientService.getMedicalTimeline(patient.id) || [];
    const ayushSummary = await patientService.getAyushSummary(patient.id);

    res.render('pages/workspace', {
      title: `Workspace - ${patient.name}`,
      headerTitle: 'Consultation Workspace',
      patient,
      apt,
      aiSummary,
      ayushSummary,
      timeline
    });
  } catch (err) {
    console.error('Workspace error:', err);
    res.status(500).send("Server Error");
  }
};
