const { emergencyAlerts } = require("../model/emergencyModel");

const createAlert = (req, res) => {
  const { patient, severity = "CRITICAL", symptomTrigger, clinicalReason, immediateAction, kioskLocation = "Main Waiting Kiosk #1" } = req.body;

  const alert = {
    id: `ALERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId: patient?.abhaId || patient?.phone || "ANONYMOUS",
    patientName: patient?.name || "Unidentified Patient",
    age: patient?.age || 0,
    gender: patient?.gender || "Unknown",
    kioskLocation,
    severity,
    symptomTrigger: symptomTrigger || "Acute Chest Discomfort + Shortness of Breath",
    clinicalReason: clinicalReason || "Potential Acute Coronary Syndrome / High Triage Emergency",
    immediateAction: immediateAction || "Immediate bedside ECG & Medical Officer priority page",
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };

  emergencyAlerts.unshift(alert);
  if (emergencyAlerts.length > 50) emergencyAlerts.pop();

  console.log(`[EMERGENCY RED FLAG ALERT DISPATCHED]`, alert);

  res.json({
    success: true,
    alert,
    activeAlertsCount: emergencyAlerts.filter((a) => !a.acknowledged).length,
  });
};

const getAlerts = (req, res) => {
  res.json({ alerts: emergencyAlerts });
};

const acknowledgeAlert = (req, res) => {
  const { alertId } = req.body;
  const target = emergencyAlerts.find((a) => a.id === alertId);
  if (target) {
    target.acknowledged = true;
    res.json({ success: true, alert: target });
  } else {
    res.status(404).json({ error: "Alert not found" });
  }
};

module.exports = {
  createAlert,
  getAlerts,
  acknowledgeAlert
};
