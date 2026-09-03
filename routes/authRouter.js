/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — auth routes
 * /login/:role covers patient, doctor, hospital, kiosk.
 * ========================================================================== */

const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');

router.get('/login/doctor/signup', authController.showDoctorSignup);
router.post('/login/doctor/signup', authController.doctorSignup);
router.post('/login/doctor', authController.doctorLogin);

router.get('/login/:role', authController.showLogin);

router.post('/login/patient/send-otp', authController.sendOtp);
router.post('/login/patient/resend-otp', authController.resendOtp);
router.post('/login/patient/verify-otp', authController.verifyOtp);
router.post('/login/patient/signup', authController.signup);

router.get('/logout', authController.logout);

module.exports = router;
