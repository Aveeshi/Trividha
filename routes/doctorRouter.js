/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — doctor routes
 * Everything here is mounted under /doctor and requires a logged-in doctor.
 * ========================================================================== */

const express = require('express');
const router = express.Router();
const doctorController = require('../controller/doctorController');

router.use(doctorController.ensureDoctor);

router.get('/dashboard', doctorController.dashboard);

module.exports = router;
