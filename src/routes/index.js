import express from 'express';
import { 
  renderDashboard, 
  updateStatus, 
  submitLeave, 
  renderProfile, 
  updateProfile, 
  updateHospitalStatus, 
  submitHospitalLeave 
} from '../controllers/dashboardController.js';
import { listHospitals, viewHospitalSlots } from '../controllers/hospitalController.js';
import { renderQueue } from '../controllers/queueController.js';
import { renderConsultation, renderWorkspace, savePrescription } from '../controllers/consultationController.js';
import { renderPerformance } from '../controllers/performanceController.js';
import { generatePrescriptionPDF } from '../controllers/pdfController.js';
import { doctorAuthMiddleware } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Apply doctor authentication and hospital context middleware across all routes
router.use(doctorAuthMiddleware);

// Dashboard routes
router.get('/', renderDashboard);
router.post('/status', updateStatus);
router.post('/leave', submitLeave);

// Hospital & Slot routes
router.get('/hospitals', listHospitals);
router.get('/hospitals/:id/slots', viewHospitalSlots);
router.post('/hospital-status', updateHospitalStatus);
router.post('/hospital-leave', submitHospitalLeave);

// OPD Queue routes
router.get('/queue', renderQueue);

// Consultation & Workspace routes
router.get('/consultation', renderConsultation);
router.get('/workspace', renderWorkspace);
router.post('/api/prescriptions', savePrescription);
router.get('/api/prescriptions/:id/pdf', generatePrescriptionPDF);

// Performance & Analytics routes
router.get('/performance', renderPerformance);

// Doctor Profile routes
router.get('/profile', renderProfile);
router.post('/profile', upload.single('profile_photo'), updateProfile);

export default router;