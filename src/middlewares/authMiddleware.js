import { doctorModel } from '../models/doctorModel.js';
import { hospitalModel } from '../models/hospitalModel.js';

// Middleware to attach authenticated doctor and hospital context to request/response
export const doctorAuthMiddleware = async (req, res, next) => {
  try {
    req.doctor = await doctorModel.getDoctorById('0a237925-b53d-4da8-af6e-ad224cefcaea');
    res.locals.doctor = req.doctor;
    res.locals.path = req.path;
    
    // Active hospital global context for header
    const activeHospitalId = doctorModel.getActiveHospital();
    if (activeHospitalId) {
      res.locals.currentHospital = await hospitalModel.getHospitalById(activeHospitalId);
    } else {
      res.locals.currentHospital = null;
    }
    next();
  } catch (err) {
    next(err);
  }
};
