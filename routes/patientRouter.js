/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — patient routes
 * Everything here is mounted under /patient and requires a logged-in patient.
 * ========================================================================== */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const patientController = require('../controller/patientController');
const documentController = require('../controller/documentController');
const appointmentController = require('../controller/appointmentController');

// Memory storage — the OCR pipeline and Cloudinary both just want the raw
// buffer, no need to touch disk. Matches what the OCR engine accepts
// (JPEG/PNG images or PDFs); anything else is rejected before it's read.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, or PDF files are accepted.'));
  },
});

router.use(patientController.ensurePatient);

router.get('/dashboard', patientController.dashboard);

router.get('/dashboard/scandocuments', documentController.showScanDocuments);
router.post('/dashboard/scandocuments', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      return res.render('patient/scan-documents', {
        account: patientController.buildAccount(req.patient),
        error: err.message || 'Could not upload your document. Please try again.',
      });
    }
    next();
  });
}, documentController.uploadDocument);

router.get('/dashboard/documents', documentController.listDocuments);

// Appointment booking — reached after the AI voice pre-consult (see
// /booking and /api/intake/*): browse doctors, view a doctor's profile and
// hospital-wise open slots, then book one to get a queue token.
router.get('/dashboard/book-appointment', appointmentController.showBookAppointment);
router.get('/doctors', appointmentController.listDoctors);
router.get('/doctors/:doctorId', appointmentController.getDoctorProfile);
router.get('/doctors/:doctorId/slots', appointmentController.getDoctorSlots);
router.post('/appointments', appointmentController.bookAppointment);
router.get('/appointments', appointmentController.listMyAppointments);
router.get('/appointments/:appointmentId', appointmentController.getMyAppointment);

module.exports = router;
