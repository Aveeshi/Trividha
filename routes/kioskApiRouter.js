const { Router } = require("express");
const { checkHealth, getPatients, lookupPatient } = require("../controller/kioskPatientController");
const {
  handleDialogue,
  handleSummarize,
  handleGetLatestSummary,
  handleGetSummaryById,
  handleGetAllSummaries,
  handleSaveTranscript,
  handleGetLatestTranscript,
  handleGetTranscriptById,
  handleGetAllTranscripts,
} = require("../controller/intakeController");
const { createAlert, getAlerts, acknowledgeAlert } = require("../controller/emergencyController");

const router = Router();

// Health check
router.get("/health", checkHealth);

// Patients API
router.get("/patients", getPatients);
router.post("/patients/lookup", lookupPatient);

// Dialogue Manager API
router.post("/intake/dialogue", handleDialogue);
router.post("/intake/summarize", handleSummarize);
router.get("/intake/summary/latest", handleGetLatestSummary);
router.get("/intake/summary/all", handleGetAllSummaries);
router.get("/intake/summary/:intakeId", handleGetSummaryById);

// Consultation Transcript API
router.post("/intake/transcript", handleSaveTranscript);
router.get("/intake/transcript/latest", handleGetLatestTranscript);
router.get("/intake/transcript/all", handleGetAllTranscripts);
router.get("/intake/transcript/:intakeId", handleGetTranscriptById);


// Emergency Alert Webhook / Dispatcher API
router.post("/emergency/alert", createAlert);
router.get("/emergency/alerts", getAlerts);
router.post("/emergency/acknowledge", acknowledgeAlert);

module.exports = router;
