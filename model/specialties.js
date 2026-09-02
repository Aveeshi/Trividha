// Keyword to Medical Specialty & Department Mapping
const SPECIALTIES = [
  {
    id: "cardiology",
    name: "Cardiology",
    department: "Department of Cardiovascular Sciences",
    room: "Room 102 (OPD Block A)",
    doctor: "Dr. Arvind Mehta, MD (Cardiology)",
    keywords: [
      "chest pain", "heart", "angina", "palpitation", "shortness of breath",
      " छाती में दर्द", "हार्ट", "धड़कन", "छातीत दुखणे", "हृदय"
    ],
    emergencyEligible: true
  },
  {
    id: "orthopedics",
    name: "Orthopedics & Joint Care",
    department: "Department of Orthopedic Surgery",
    room: "Room 205 (OPD Block B)",
    doctor: "Dr. Vikram Joshi, MS (Ortho)",
    keywords: [
      "joint pain", "knee", "back pain", "arthritis", "fracture", "stiffness",
      "घुटने का दर्द", "जोड़ों का दर्द", "कमर दर्द", "सांधेदुखी", "गुडघेदुखी"
    ],
    emergencyEligible: false
  },
  {
    id: "pulmonology",
    name: "Pulmonology & Respiratory Medicine",
    department: "Chest & Respiratory Medicine",
    room: "Room 108 (OPD Block A)",
    doctor: "Dr. Sunita Sharma, MD (Pulmonology)",
    keywords: [
      "cough", "asthma", "wheezing", "breathlessness", "phlegm", "cold",
      "खांसी", "दमा", "सांस फूलना", "खोकला", "दम लागणे"
    ],
    emergencyEligible: true
  },
  {
    id: "gastroenterology",
    name: "Gastroenterology",
    department: "Department of Digestive Diseases",
    room: "Room 304 (OPD Block C)",
    doctor: "Dr. Rajesh Iyer, MD, DM (Gastro)",
    keywords: [
      "stomach pain", "acidity", "vomiting", "gas", "constipation", "diarrhea",
      "पेट दर्द", "एसिडिटी", "उल्टी", "पोटदुखी", "बद्धकोष्ठता"
    ],
    emergencyEligible: false
  },
  {
    id: "neurology",
    name: "Neurology",
    department: "Neurosciences Center",
    room: "Room 401 (OPD Block D)",
    doctor: "Dr. Priya Nair, DM (Neurology)",
    keywords: [
      "headache", "migraine", "dizziness", "numbness", "seizure", "paralysis",
      "सिरदर्द", "चक्कर", "माइग्रेन", "डोकेदुखी", "भोवळ"
    ],
    emergencyEligible: true
  },
  {
    id: "dermatology",
    name: "Dermatology",
    department: "Department of Skin & Cosmetology",
    room: "Room 112 (OPD Block A)",
    doctor: "Dr. Ananya Roy, MD (Dermatology)",
    keywords: [
      "skin rash", "itching", "allergy", "pimples", "fungal",
      "खुजली", "त्वचा रोग", "खाज", "पुरळ"
    ],
    emergencyEligible: false
  },
  {
    id: "general_medicine",
    name: "General Internal Medicine & Triage",
    department: "Internal Medicine Outpatient Clinic",
    room: "Room 101 (Main Triage & OPD)",
    doctor: "Dr. Ramesh Patel, MD (Internal Medicine)",
    keywords: [
      "fever", "weakness", "body ache", "fatigue", "general checkup", "health",
      "बुखार", "कमजोरी", "थकान", "ताप", "अशक्तपणा"
    ],
    emergencyEligible: false
  }
];

module.exports = {
  SPECIALTIES
};
