const { query } = require("../utils/kioskDb");
const { SAMPLE_PATIENTS } = require("../model/patientModel");

const checkHealth = (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

function formatSupabasePatient(row) {
  const birthYear = row.date_of_birth ? new Date(row.date_of_birth).getFullYear() : null;
  const age = birthYear ? Math.max(0, new Date().getFullYear() - birthYear) : 35;
  const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Patient";

  return {
    patient_id: row.patient_id,
    id: row.patient_id,
    name: fullName,
    age,
    gender: row.gender || "Unspecified",
    phone: row.phone_number || "—",
    photo:
      row.gender?.toUpperCase() === "FEMALE"
        ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    bloodGroup: row.blood_group || "B+",
    primaryLanguage: "Hindi",
    abhaId: row.abha_id || "N/A",
    abhaAddress: row.email ? `${row.email.split("@")[0]}@abdm` : "patient@abdm",
    knownRecords: {
      chronicConditions: ["None reported"],
      allergies: ["None known"],
      currentMedications: ["None"],
      pastSurgeries: ["None"],
      lastVisitDate: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "—",
      lastVisitReason: "Initial pre-consultation intake",
    },
  };
}

const getPatients = async (req, res) => {
  try {
    const dbRes = await query("SELECT * FROM patient ORDER BY created_at ASC;");
    if (dbRes.rows.length > 0) {
      const dbPatients = dbRes.rows.map(formatSupabasePatient);
      // Combine with sample patients, ensuring Supabase patients have priority and valid UUIDs
      return res.json({ patients: [...dbPatients, ...SAMPLE_PATIENTS] });
    }
  } catch (err) {
    console.error("Error fetching patients from Supabase:", err.message);
  }
  res.json({ patients: SAMPLE_PATIENTS });
};

const lookupPatient = async (req, res) => {
  const { query: searchQuery } = req.body;
  if (!searchQuery) {
    return res.status(400).json({ error: "Query parameter required" });
  }

  const cleanQuery = searchQuery.toLowerCase().trim().replace(/[- ]/g, "");

  try {
    const dbRes = await query("SELECT * FROM patient;");
    const dbPatients = dbRes.rows.map(formatSupabasePatient);
    const all = [...dbPatients, ...SAMPLE_PATIENTS];

    const found = all.find(
      (p) =>
        (p.abhaId && p.abhaId.replace(/[- ]/g, "").toLowerCase().includes(cleanQuery)) ||
        (p.abhaAddress && p.abhaAddress.toLowerCase().includes(cleanQuery)) ||
        (p.phone && p.phone.replace(/[- ]/g, "").includes(cleanQuery)) ||
        (p.name && p.name.toLowerCase().includes(cleanQuery))
    );

    if (found) {
      return res.json({ found: true, patient: found });
    }
  } catch (err) {
    console.error("Lookup error:", err);
  }

  res.json({ found: false, message: "No existing ABHA records found. You can register as a new patient." });
};

module.exports = {
  checkHealth,
  getPatients,
  lookupPatient,
};

