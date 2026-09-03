import { supabase } from '../config/supabase.js';

export const appointmentModel = {
  getAppointmentsBySlot: async (slotId) => {
    // We join appointment with patient and queue_entry
    const { data, error } = await supabase
      .from('appointment')
      .select('*, patient(*), queue_entry(*)')
      .eq('slot_id', slotId);
      
    if (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
    
    return data.map(apt => {
      // Get the queue status, falling back to appointment status
      const queueStatus = apt.queue_entry && apt.queue_entry.length > 0 
        ? apt.queue_entry[0].queue_status 
        : apt.appointment_status;
        
      const token = apt.queue_entry && apt.queue_entry.length > 0 
        ? apt.queue_entry[0].current_position 
        : apt.token_number;
        
      return {
        id: apt.appointment_id,
        patientId: apt.patient_id,
        slotId: apt.slot_id,
        time: apt.estimated_consultation_time ? new Date(apt.estimated_consultation_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '09:00 AM', // Mocking time for now if null
        status: queueStatus,
        type: apt.booking_source,
        token: token,
        patient: {
          id: apt.patient.patient_id,
          name: `${apt.patient.first_name} ${apt.patient.last_name}`,
          age: new Date().getFullYear() - new Date(apt.patient.date_of_birth).getFullYear(),
          gender: apt.patient.gender,
          bloodGroup: apt.patient.blood_group,
          phone: apt.patient.phone_number
        }
      };
    }).sort((a, b) => {
      // Push completed patients to the bottom of the queue
      const isACompleted = a.status === 'COMPLETED' ? 1 : 0;
      const isBCompleted = b.status === 'COMPLETED' ? 1 : 0;
      
      if (isACompleted !== isBCompleted) {
        return isACompleted - isBCompleted; // 1 means it goes lower
      }
      
      // Otherwise sort normally by token number
      return a.token - b.token;
    });
  },
  
  getAppointmentById: async (id) => {
    const { data, error } = await supabase
      .from('appointment')
      .select('*, patient(*), queue_entry(*)')
      .eq('appointment_id', id)
      .single();
      
    if (error || !data) return null;
    
    return {
      id: data.appointment_id,
      patientId: data.patient_id,
      status: data.appointment_status,
      // mapping as needed...
    };
  }
};

export const appointmentService = appointmentModel;
