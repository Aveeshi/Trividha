import { supabase } from '../config/supabase.js';

// In-memory cache for UI session state (since this isn't saved in DB yet)
const sessionState = {
  currentStatus: 'Available',
  activeHospitalId: null,
  leaveRequests: []
};

export const doctorModel = {
  getDoctorById: async (id) => {
    const { data: doctor, error } = await supabase
      .from('doctor')
      .select('*')
      .eq('doctor_id', id)
      .single();
      
    if (error || !doctor) return null;

    const { data: leaves } = await supabase
      .from('doctor_leave')
      .select('*')
      .eq('doctor_id', id);

    const formattedLeaves = (leaves || []).map(l => ({
      fromDate: new Date(l.start_date).toLocaleDateString(),
      toDate: new Date(l.end_date).toLocaleDateString(),
      reason: l.reason,
      status: 'Pending Approval'
    }));
    
    // Attach session state for our UI
    return {
      ...doctor,
      activeHospitalId: sessionState.activeHospitalId,
      currentStatus: sessionState.currentStatus,
      leaveRequests: formattedLeaves,
      leavesTaken: formattedLeaves.length
    };
  },
  
  getDoctorPerformance: async (id) => {
    // Count real completed appointments
    const { count, error } = await supabase
      .from('appointment')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', id)
      .eq('appointment_status', 'COMPLETED');
      
    if (error) console.error('Error fetching performance:', error);
    
    // Rating and promptness are mocked since there are no feedback tables in schema yet
    return { 
      rating: 4.9, 
      promptness: 98,
      patientsTreated: count || 0
    };
  },
  
  updateStatus: (id, status) => {
    sessionState.currentStatus = status;
  },
  
  setActiveHospital: (id, hospitalId) => {
    sessionState.activeHospitalId = hospitalId;
  },
  
  getActiveHospital: () => {
    return sessionState.activeHospitalId;
  },
  
  getCurrentStatus: () => {
    return sessionState.currentStatus;
  },
  
  addLeaveRequest: async (id, reason, fromDate, toDate) => {
    const { error } = await supabase.from('doctor_leave').insert({
      doctor_id: id,
      hospital_id: sessionState.activeHospitalId || 1, // Fallback to 1 if no active hospital
      start_date: fromDate,
      end_date: toDate,
      reason: reason
    });
    if (error) console.error('Error adding leave request:', error);
  }
};

export const doctorService = doctorModel;
