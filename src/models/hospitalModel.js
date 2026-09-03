import { supabase } from '../config/supabase.js';

export const hospitalModel = {
  getHospitalsForDoctor: async (doctorId) => {
    const { data, error } = await supabase
      .from('doctor_hospital')
      .select('doctor_hospital_id, department, enrollment_status, hospital(*)')
      .eq('doctor_id', doctorId);
      
    if (error) {
      console.error('Error fetching doctor hospitals:', error);
      return [];
    }
    
    return data.map(row => ({
      doctorHospitalId: row.doctor_hospital_id,
      id: row.hospital.hospital_id,
      name: row.hospital.name,
      location: `${row.hospital.city}, ${row.hospital.state}`,
      department: row.department,
      ayushMode: row.hospital.ayush_mode_enabled,
      enrollmentStatus: row.enrollment_status
    }));
  },
  
  updateHospitalStatus: async (doctorHospitalId, status) => {
    const { error } = await supabase
      .from('doctor_hospital')
      .update({ enrollment_status: status })
      .eq('doctor_hospital_id', parseInt(doctorHospitalId));
    if (error) console.error('Error updating hospital status:', error.message);
  },
  
  getHospitalById: async (hospitalId) => {
    if (!hospitalId) return null;
    const { data, error } = await supabase
      .from('hospital')
      .select('*')
      .eq('hospital_id', hospitalId)
      .single();
      
    if (error || !data) {
      console.error('Error fetching hospital:', error);
      return null;
    }
    
    return {
      id: data.hospital_id,
      name: data.name,
      location: `${data.city}, ${data.state}`,
      ayushMode: data.ayush_mode_enabled,
      department: 'General'
    };
  }
};

export const hospitalService = hospitalModel;
