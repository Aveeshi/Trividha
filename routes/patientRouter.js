/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — patient routes
 * Everything here is mounted under /patient and requires a logged-in patient.
 * ========================================================================== */

const express = require('express');
const router = express.Router();
const patientController = require('../controller/patientController');

router.use(patientController.ensurePatient);

router.get('/dashboard', patientController.dashboard);

module.exports = router;
