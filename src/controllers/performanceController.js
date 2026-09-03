import { doctorModel, doctorService } from '../models/doctorModel.js';

export const renderPerformance = async (req, res) => {
  try {
    const performance = await doctorService.getDoctorPerformance(req.doctor.doctor_id);
    res.render('pages/performance', {
      title: 'Trividha - Performance',
      headerTitle: 'Performance & Feedback',
      performance
    });
  } catch(err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
