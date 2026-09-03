import { appointmentModel, appointmentService } from '../models/appointmentModel.js';

export const renderQueue = async (req, res) => {
  try {
    const slotId = parseInt(req.query.slotId) || 1;
    const queue = await appointmentService.getAppointmentsBySlot(slotId);
    
    res.render('pages/queue', {
      title: 'Trividha - Patient Queue',
      headerTitle: 'Patient Queue',
      queue
    });
  } catch(err) {
    console.error('Queue error:', err);
    res.status(500).send(err.stack);
  }
};
