import { supabase } from '../config/supabase.js';

export const slotModel = {
  getSlotsByDoctorAndHospital: async (doctorId, hospitalId) => {
    const { data, error } = await supabase
      .from('appointment_slot')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('hospital_id', hospitalId)
      .order('start_time', { ascending: true });
      
    if (error) return [];
    
    return data.map(slot => ({
      id: slot.slot_id,
      doctorId: slot.doctor_id,
      hospitalId: slot.hospital_id,
      time: `${slot.start_time.slice(0,5)} - ${slot.end_time.slice(0,5)}`,
      capacity: slot.max_capacity,
      status: slot.status
    }));
  },
  
  getSlotsByDoctor: async (doctorId) => {
    const { data, error } = await supabase
      .from('appointment_slot')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('start_time', { ascending: true });
      
    if (error) return [];
    
    return data.map(slot => ({
      id: slot.slot_id,
      doctorId: slot.doctor_id,
      hospitalId: slot.hospital_id,
      time: `${slot.start_time.slice(0,5)} - ${slot.end_time.slice(0,5)}`,
      capacity: slot.max_capacity,
      status: slot.status
    }));
  }
};

export const slotService = slotModel;
