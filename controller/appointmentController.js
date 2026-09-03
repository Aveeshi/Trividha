/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — appointment booking controller
 *
 * Patient-facing JSON API for the flow that follows the AI voice pre-consult
 * intake (see intakeController.js / /api/intake/*):
 *   GET  /patient/doctors             — browse doctors near the patient
 *   GET  /patient/doctors/:doctorId   — one doctor's full profile
 *   GET  /patient/doctors/:doctorId/slots — that doctor's open slots, grouped by hospital
 *   POST /patient/appointments        — book a slot, get back a token
 *   GET  /patient/appointments        — the patient's own bookings
 *   GET  /patient/appointments/:id    — one booking's detail
 *
 * All routes are mounted behind patientController.ensurePatient, so
 * req.patient is always the logged-in patient.
 * ========================================================================== */

const appointmentModel = require('../model/appointmentModel');
const { AppointmentError } = appointmentModel;
const { buildAccount } = require('./patientController');

// Page shell for the doctor-browse/book flow (see public/js/book-appointment.js
// for the actual doctor list / slots / booking logic — this just renders the
// page and hands it the AI intake session id, if the patient arrived here
// straight from finishing the voice pre-consult at /booking).
function showBookAppointment(req, res) {
  res.render('patient/book-appointment', {
    account: buildAccount(req.patient),
    aiSessionId: req.query.sessionId || null,
  });
}

// Central error mapper so every handler below can just `catch` and delegate.
function handleError(res, err, fallbackMessage) {
  if (err instanceof AppointmentError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(fallbackMessage, err);
  return res.status(500).json({ error: 'Something went wrong.' });
}

async function listDoctors(req, res) {
  try {
    const { city, specialization, hospitalId, q } = req.query;
    const doctors = await appointmentModel.listDoctorsNearby({
      city: city || null,
      specialization: specialization || null,
      hospitalId: hospitalId ? Number(hospitalId) : null,
      search: q || null,
    });
    res.json({ doctors });
  } catch (err) {
    handleError(res, err, 'appointmentController.listDoctors error:');
  }
}

async function getDoctorProfile(req, res) {
  try {
    const doctor = await appointmentModel.getDoctorProfile(req.params.doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    res.json({ doctor });
  } catch (err) {
    handleError(res, err, 'appointmentController.getDoctorProfile error:');
  }
}

async function getDoctorSlots(req, res) {
  try {
    const { hospitalId, date } = req.query;
    const slots = await appointmentModel.getDoctorSlots(req.params.doctorId, {
      hospitalId: hospitalId ? Number(hospitalId) : null,
      fromDate: date || null,
    });

    // Group hospital-wise so the UI can show "Available at <hospital>" cards.
    const byHospital = new Map();
    for (const slot of slots) {
      if (!byHospital.has(slot.hospital_id)) {
        byHospital.set(slot.hospital_id, {
          hospitalId: slot.hospital_id,
          hospitalName: slot.hospital_name,
          city: slot.hospital_city,
          address: slot.hospital_address,
          slots: [],
        });
      }
      byHospital.get(slot.hospital_id).slots.push({
        slotId: slot.slot_id,
        date: slot.slot_date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        seatsLeft: slot.max_capacity - slot.current_count,
      });
    }

    res.json({ hospitals: Array.from(byHospital.values()) });
  } catch (err) {
    handleError(res, err, 'appointmentController.getDoctorSlots error:');
  }
}

async function bookAppointment(req, res) {
  try {
    const { doctorId, slotId, aiSessionId } = req.body;
    if (!doctorId || !slotId) {
      return res.status(400).json({ error: 'doctorId and slotId are required.' });
    }

    const { appointment, queueEntry } = await appointmentModel.bookAppointment({
      patientId: req.patient.patient_id,
      doctorId,
      slotId,
      aiSessionId: aiSessionId || null,
    });

    res.status(201).json({
      appointment: {
        appointmentId: appointment.appointment_id,
        tokenNumber: appointment.token_number,
        status: appointment.appointment_status,
        doctorId: appointment.doctor_id,
        hospitalId: appointment.hospital_id,
        slotId: appointment.slot_id,
        bookingTime: appointment.booking_time,
      },
      queue: queueEntry && {
        position: queueEntry.current_position,
        estimatedWaitMinutes: queueEntry.estimated_wait_minutes,
        estimatedTurnTime: queueEntry.estimated_turn_time,
      },
    });
  } catch (err) {
    handleError(res, err, 'appointmentController.bookAppointment error:');
  }
}

async function listMyAppointments(req, res) {
  try {
    const appointments = await appointmentModel.listAppointmentsForPatient(req.patient.patient_id);
    res.json({ appointments });
  } catch (err) {
    handleError(res, err, 'appointmentController.listMyAppointments error:');
  }
}

async function getMyAppointment(req, res) {
  try {
    const appointment = await appointmentModel.getAppointmentForPatient(
      req.params.appointmentId,
      req.patient.patient_id
    );
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
    res.json({ appointment });
  } catch (err) {
    handleError(res, err, 'appointmentController.getMyAppointment error:');
  }
}

module.exports = {
  showBookAppointment,
  listDoctors,
  getDoctorProfile,
  getDoctorSlots,
  bookAppointment,
  listMyAppointments,
  getMyAppointment,
};
