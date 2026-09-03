import { supabase } from '../config/supabase.js';

export const patientModel = {
  getPatientById: async (id) => {
    const { data, error } = await supabase
      .from('patient')
      .select('*')
      .eq('patient_id', id)
      .single();
      
    if (error || !data) return null;
    
    return {
      id: data.patient_id,
      name: `${data.first_name} ${data.last_name}`,
      abhaId: data.abha_id || 'Not Linked',
      age: new Date().getFullYear() - new Date(data.date_of_birth).getFullYear(),
      gender: data.gender,
      bloodGroup: data.blood_group || 'Unknown',
      vitals: {
        bp: '120/80 mmHg', // Mocks for now until vitals table is mapped
        temp: '98.6 °F',
        hr: '72 bpm'
      },
      allergies: ['Penicillin', 'Dust']
    };
  },
  
  getAISummary: async (id) => {
    // Fetch past prescriptions to show in "Current Medications"
    const { data: pastPrescriptions } = await supabase
      .from('prescription')
      .select('prescription_item(medicine_name)')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .limit(3);

    let meds = ["None"];
    if (pastPrescriptions && pastPrescriptions.length > 0) {
      meds = pastPrescriptions.flatMap(p => p.prescription_item.map(i => i.medicine_name));
      // Deduplicate meds
      meds = [...new Set(meds)];
      if (meds.length === 0) meds = ["None"];
    }

    return {
      chiefComplaint: "General consultation",
      duration: "Recent",
      symptoms: ["Pending patient input"],
      currentMedications: meds,
      allergies: ["None"],
      observations: "Awaiting physical examination.",
      voiceTranscript: "Transcript unavailable."
    };
  },
  
  getAyushSummary: async (id) => {
    // Fetch prakriti/vikriti from patient table
    const { data } = await supabase
      .from('patient')
      .select('prakriti, vikriti')
      .eq('patient_id', id)
      .single();
      
    if (!data || (!data.prakriti && !data.vikriti)) return null;
    
    return {
      prakriti: data.prakriti || 'Not Assessed',
      vikriti: data.vikriti || 'Not Assessed',
      agni: 'Not Assessed',
      koshta: 'Not Assessed',
      aharaVihara: 'Standard Diet',
      dashaVidhaPariksha: 'Pending'
    };
  },
  
  getMedicalTimeline: async (id) => {
    // Build a real timeline by fetching prescriptions and medical instructions
    const { data: prescriptions } = await supabase
      .from('prescription')
      .select('*, prescription_item(*)')
      .eq('patient_id', id)
      .order('created_at', { ascending: false });
      
    const { data: instructions } = await supabase
      .from('patient_medical_instruction')
      .select('*')
      .eq('patient_id', id)
      .order('created_at', { ascending: false });
      
    const timeline = [];
    
    if (prescriptions) {
      prescriptions.forEach(p => {
        const meds = p.prescription_item.map(i => i.medicine_name).join(', ');
        timeline.push({
          date: new Date(p.created_at).toLocaleDateString(),
          title: 'Prescription Issued',
          description: `Prescribed: ${meds || 'No medicines'}`
        });
      });
    }
    
    if (instructions) {
      instructions.forEach(inst => {
        timeline.push({
          date: new Date(inst.created_at).toLocaleDateString(),
          title: 'Medical Instruction',
          description: inst.instruction_text
        });
      });
    }
    
    // Sort timeline by date descending
    return timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
};

export const patientService = patientModel;
