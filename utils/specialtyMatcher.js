// Specialty Matcher: Free-Text Clinical Reason & Symptoms to Best Hospital Specialty
const { SPECIALTIES } = require("../model/specialties");

/**
 * Matches free-text complaints / clinical history to the most appropriate hospital specialty
 * @param {string} text - User spoken or typed symptom text
 * @returns {object} Matching specialty object with department, room, and doctor details
 */
function matchSpecialty(text = "") {
  if (!text || typeof text !== "string") {
    return SPECIALTIES.find((s) => s.id === "general_medicine") || SPECIALTIES[0];
  }

  const lowerText = text.toLowerCase();

  // Search each specialty keywords
  for (const specialty of SPECIALTIES) {
    for (const keyword of specialty.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return specialty;
      }
    }
  }

  // Fallback to General Internal Medicine & Triage
  return (
    SPECIALTIES.find((s) => s.id === "general_medicine") ||
    SPECIALTIES[0]
  );
}

/**
 * Checks if symptoms match critical emergency criteria
 * @param {string} text
 * @returns {{ isEmergency: boolean, reason: string }}
 */
function checkEmergencyFlag(text = "") {
  const lowerText = (text || "").toLowerCase();
  const criticalKeywords = [
    "crushing chest pain", "unconscious", "stroke", "paralysis", "vomiting blood",
    "severe bleeding", "heart attack", "difficulty breathing severe", "अनकॉन्शियस",
    "छाती में असहनीय दर्द", "बेहोश"
  ];

  for (const kw of criticalKeywords) {
    if (lowerText.includes(kw)) {
      return {
        isEmergency: true,
        reason: `Critical clinical red flag detected (${kw}). Emergency Room 101 code dispatched.`
      };
    }
  }

  return { isEmergency: false, reason: "" };
}

module.exports = {
  matchSpecialty,
  checkEmergencyFlag
};
