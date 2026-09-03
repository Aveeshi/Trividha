/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — appointment booking model
 * Column names match the DB exactly (see information_schema): doctor,
 * hospital, doctor_hospital, appointment_slot, appointment, queue_entry,
 * queue_configuration, patient_feedback, doctor_performance, ai_session,
 * ai_summary.
 *
 * Booking flow this module implements:
 *   1. listDoctorsNearby      — doctors a patient can browse, optionally
 *                                filtered by city/specialization/hospital.
 *   2. getDoctorProfile       — one doctor's public profile (photo, years of
 *                                experience, qualification, rating, reviews,
 *                                patients treated) + the hospitals they see
 *                                patients at.
 *   3. getDoctorSlots         — that doctor's open, hospital-wise upcoming
 *                                appointment_slot rows.
 *   4. bookAppointment        — books a slot: allocates a token, inserts the
 *                                appointment, occupies a queue_entry, and (if
 *                                an AI pre-consult session id is passed)
 *                                links that ai_session/ai_summary to the new
 *                                appointment so the reason-for-visit and
 *                                transcript travel with it for the doctor
 *                                portal later.
 *   5. listAppointmentsForPatient / getAppointmentForPatient — a patient's
 *                                own bookings, for their dashboard.
 * ========================================================================== */

const pool = require('./db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

// Small typed error so the controller can map it to the right HTTP status
// without string-matching messages.
class AppointmentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppointmentError';
    this.statusCode = statusCode;
  }
}

// Shared lateral-join fragments used by both listDoctorsNearby and
// getDoctorProfile so the two stay consistent.
const DOCTOR_STATS_CTE = `
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
             'hospitalId', h.hospital_id,
             'hospitalName', h.name,
             'city', h.city,
             'state', h.state,
             'address', h.address,
             'department', dh.department,
             'specializationAtHospital', dh.specialization_at_hospital
           ) ORDER BY h.name) AS hospitals
    FROM doctor_hospital dh
    JOIN hospital h ON h.hospital_id = dh.hospital_id AND h.status = 'ACTIVE'
    WHERE dh.doctor_id = d.doctor_id AND dh.enrollment_status = 'ACTIVE'
  ) hosp ON true
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(rating), 1) AS average_rating, COUNT(*) AS review_count
    FROM patient_feedback
    WHERE doctor_id = d.doctor_id
  ) fb ON true
  LEFT JOIN LATERAL (
    SELECT SUM(patients_treated) AS patients_treated
    FROM doctor_performance
    WHERE doctor_id = d.doctor_id
  ) perf ON true
`;

/**
 * Doctors a patient can browse. "Locality" is expressed as the city of the
 * hospitals a doctor is actively enrolled at — a doctor shows up if ANY of
 * their active hospitals matches the given city.
 */
async function listDoctorsNearby({ city, specialization, hospitalId, search } = {}) {
  const conditions = [`d.registration_status = 'VERIFIED'`];
  const params = [];

  conditions.push(`EXISTS (
    SELECT 1 FROM doctor_hospital dh2
    JOIN hospital h2 ON h2.hospital_id = dh2.hospital_id AND h2.status = 'ACTIVE'
    WHERE dh2.doctor_id = d.doctor_id AND dh2.enrollment_status = 'ACTIVE'
    ${city ? `AND h2.city ILIKE $${params.push(`%${city}%`)}` : ''}
    ${hospitalId ? `AND h2.hospital_id = $${params.push(hospitalId)}` : ''}
  )`);

  if (specialization) {
    conditions.push(`d.specialization ILIKE $${params.push(`%${specialization}%`)}`);
  }
  if (search) {
    const idx = params.push(`%${search}%`);
    conditions.push(`(d.name ILIKE $${idx} OR d.specialization ILIKE $${idx})`);
  }

  const { rows } = await pool.query(
    `SELECT
        d.doctor_id, d.name, d.specialization, d.qualification,
        d.experience_years, d.profile_photo, d.bio,
        COALESCE(hosp.hospitals, '[]') AS hospitals,
        COALESCE(fb.average_rating, 0) AS average_rating,
        COALESCE(fb.review_count, 0) AS review_count,
        COALESCE(perf.patients_treated, 0) AS patients_treated
     FROM doctor d
     ${DOCTOR_STATS_CTE}
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.name ASC`,
    params
  );
  return rows;
}

/**
 * One doctor's full public profile: everything listDoctorsNearby shows plus
 * the doctor's most recent reviews (rating + comment).
 */
async function getDoctorProfile(doctorId) {
  if (!isUuid(doctorId)) throw new AppointmentError('Invalid doctor id.', 400);

  const { rows } = await pool.query(
    `SELECT
        d.doctor_id, d.name, d.specialization, d.qualification,
        d.experience_years, d.profile_photo, d.bio, d.registration_status,
        COALESCE(hosp.hospitals, '[]') AS hospitals,
        COALESCE(fb.average_rating, 0) AS average_rating,
        COALESCE(fb.review_count, 0) AS review_count,
        COALESCE(perf.patients_treated, 0) AS patients_treated,
        COALESCE(rev.reviews, '[]') AS reviews
     FROM doctor d
     ${DOCTOR_STATS_CTE}
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(jsonb_build_object(
                'rating', recent.rating,
                'feedbackText', recent.feedback_text,
                'createdAt', recent.created_at,
                'patientFirstName', p.first_name
              ) ORDER BY recent.created_at DESC) AS reviews
       FROM (
         SELECT * FROM patient_feedback
         WHERE doctor_id = d.doctor_id
         ORDER BY created_at DESC
         LIMIT 5
       ) recent
       JOIN patient p ON p.patient_id = recent.patient_id
     ) rev ON true
     WHERE d.doctor_id = $1`,
    [doctorId]
  );
  return rows[0] || null;
}

/**
 * A doctor's open, bookable slots across every hospital they practice at
 * (or just one, via hospitalId), from `fromDate` onward (default: today).
 */
async function getDoctorSlots(doctorId, { hospitalId, fromDate } = {}) {
  if (!isUuid(doctorId)) throw new AppointmentError('Invalid doctor id.', 400);

  const params = [doctorId, fromDate || null];
  let sql = `
    SELECT
      s.slot_id, s.doctor_id, s.hospital_id,
      h.name AS hospital_name, h.city AS hospital_city, h.address AS hospital_address,
      s.slot_date, s.start_time, s.end_time,
      s.max_capacity, s.current_count, s.status
    FROM appointment_slot s
    JOIN hospital h ON h.hospital_id = s.hospital_id
    WHERE s.doctor_id = $1
      AND s.slot_date >= COALESCE($2::date, CURRENT_DATE)
      AND s.status = 'OPEN'
      AND s.current_count < s.max_capacity
  `;
  if (hospitalId) {
    sql += ` AND s.hospital_id = $${params.push(hospitalId)}`;
  }
  sql += ' ORDER BY s.slot_date ASC, s.start_time ASC';

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Per-doctor-per-hospital default consultation length, used to estimate a
// new booking's queue wait. Falls back to a hospital-wide config, then a
// hard default, since queue_configuration rows are optional.
async function getConsultationMinutes(client, { doctorId, hospitalId }) {
  const { rows } = await client.query(
    `SELECT default_consultation_minutes FROM queue_configuration
     WHERE hospital_id = $1 AND (doctor_id = $2 OR doctor_id IS NULL)
     ORDER BY doctor_id NULLS LAST
     LIMIT 1`,
    [hospitalId, doctorId]
  );
  return rows[0]?.default_consultation_minutes || 15;
}

/**
 * Books an appointment slot for a patient:
 *   - locks the slot row so two simultaneous bookings can't both grab the
 *     last seat,
 *   - allocates the next token number for that slot,
 *   - inserts the appointment + a queue_entry for it,
 *   - marks the slot FULL once capacity is reached,
 *   - optionally links an existing AI pre-consultation session (and its
 *     summary) to the new appointment, so the doctor portal can later pull
 *     up the reason-for-visit and transcript for this booking.
 *
 * Returns { appointment, queueEntry }.
 */
async function bookAppointment({ patientId, doctorId, slotId, aiSessionId = null }) {
  if (!isUuid(patientId)) throw new AppointmentError('Invalid patient id.', 400);
  if (!isUuid(doctorId)) throw new AppointmentError('Invalid doctor id.', 400);
  const slotIdNum = Number(slotId);
  if (!Number.isInteger(slotIdNum)) throw new AppointmentError('Invalid slot id.', 400);
  if (aiSessionId !== null && !isUuid(aiSessionId)) {
    throw new AppointmentError('Invalid AI session id.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const slotRes = await client.query(
      `SELECT * FROM appointment_slot WHERE slot_id = $1 AND doctor_id = $2 FOR UPDATE`,
      [slotIdNum, doctorId]
    );
    const slot = slotRes.rows[0];
    if (!slot) {
      throw new AppointmentError('That appointment slot does not exist for this doctor.', 404);
    }
    if (slot.status !== 'OPEN' || slot.current_count >= slot.max_capacity) {
      throw new AppointmentError('That slot is no longer available.', 409);
    }

    // Token numbers must be unique per slot (appointment_slot_id, token_number).
    // current_count is meant to track the same thing, but derive the token from
    // the actual appointment rows rather than trusting current_count is in
    // sync with them — the slot row is already locked above, so this is race-safe.
    const tokenRes = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
         FROM appointment WHERE slot_id = $1`,
      [slot.slot_id]
    );
    const tokenNumber = tokenRes.rows[0].next_token;
    const newCount = slot.current_count + 1;
    const newStatus = newCount >= slot.max_capacity ? 'FULL' : 'OPEN';

    const apptRes = await client.query(
      `INSERT INTO appointment
         (patient_id, doctor_id, hospital_id, slot_id, token_number, booking_source, appointment_status)
       VALUES ($1, $2, $3, $4, $5, 'PATIENT_PORTAL', 'BOOKED')
       RETURNING *`,
      [patientId, doctorId, slot.hospital_id, slot.slot_id, tokenNumber]
    );
    const appointment = apptRes.rows[0];

    await client.query(
      `UPDATE appointment_slot
          SET current_count = $2, status = $3, updated_at = now()
        WHERE slot_id = $1`,
      [slot.slot_id, newCount, newStatus]
    );

    const consultMinutes = await getConsultationMinutes(client, {
      doctorId,
      hospitalId: slot.hospital_id,
    });
    const estimatedWaitMinutes = (tokenNumber - 1) * consultMinutes;

    const queueRes = await client.query(
      `INSERT INTO queue_entry
         (appointment_id, slot_id, original_position, current_position, queue_status,
          estimated_wait_minutes, estimated_turn_time)
       VALUES ($1, $2, $3, $3, 'WAITING', $4,
               (($5::date + $6::time) + ($4::int * INTERVAL '1 minute')))
       RETURNING *`,
      [appointment.appointment_id, slot.slot_id, tokenNumber, estimatedWaitMinutes, slot.slot_date, slot.start_time]
    );
    const queueEntry = queueRes.rows[0];

    // Carry the AI pre-consultation intake (reason for visit + transcript)
    // over to this appointment, scoped to this patient so one patient can't
    // attach another's session to their own booking.
    if (aiSessionId) {
      const linked = await client.query(
        `UPDATE ai_session
            SET appointment_id = $2
          WHERE ai_session_id = $1 AND patient_id = $3
          RETURNING ai_session_id`,
        [aiSessionId, appointment.appointment_id, patientId]
      );
      if (linked.rows.length > 0) {
        await client.query(
          `UPDATE ai_summary SET appointment_id = $2 WHERE ai_session_id = $1`,
          [aiSessionId, appointment.appointment_id]
        );
      }
    }

    await client.query('COMMIT');
    return { appointment, queueEntry };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * A patient's own appointments (upcoming first), for their dashboard.
 */
async function listAppointmentsForPatient(patientId) {
  if (!isUuid(patientId)) throw new AppointmentError('Invalid patient id.', 400);

  const { rows } = await pool.query(
    `SELECT
        a.appointment_id, a.appointment_status, a.token_number, a.booking_time,
        a.arrival_status, a.estimated_consultation_time,
        s.slot_date, s.start_time, s.end_time,
        d.doctor_id, d.name AS doctor_name, d.specialization, d.profile_photo,
        h.hospital_id, h.name AS hospital_name, h.city AS hospital_city,
        q.current_position, q.estimated_wait_minutes, q.estimated_turn_time, q.queue_status
     FROM appointment a
     JOIN appointment_slot s ON s.slot_id = a.slot_id
     JOIN doctor d ON d.doctor_id = a.doctor_id
     JOIN hospital h ON h.hospital_id = a.hospital_id
     LEFT JOIN queue_entry q ON q.appointment_id = a.appointment_id
     WHERE a.patient_id = $1
     ORDER BY s.slot_date DESC, s.start_time DESC`,
    [patientId]
  );
  return rows;
}

/**
 * One appointment, scoped to the owning patient so a patient can never look
 * up another patient's appointment by guessing its id.
 */
async function getAppointmentForPatient(appointmentId, patientId) {
  if (!isUuid(appointmentId)) throw new AppointmentError('Invalid appointment id.', 400);
  if (!isUuid(patientId)) throw new AppointmentError('Invalid patient id.', 400);

  const { rows } = await pool.query(
    `SELECT
        a.appointment_id, a.appointment_status, a.token_number, a.booking_time,
        a.arrival_status, a.estimated_consultation_time,
        s.slot_id, s.slot_date, s.start_time, s.end_time,
        d.doctor_id, d.name AS doctor_name, d.specialization, d.profile_photo, d.qualification,
        h.hospital_id, h.name AS hospital_name, h.city AS hospital_city, h.address AS hospital_address,
        q.current_position, q.estimated_wait_minutes, q.estimated_turn_time, q.queue_status
     FROM appointment a
     JOIN appointment_slot s ON s.slot_id = a.slot_id
     JOIN doctor d ON d.doctor_id = a.doctor_id
     JOIN hospital h ON h.hospital_id = a.hospital_id
     LEFT JOIN queue_entry q ON q.appointment_id = a.appointment_id
     WHERE a.appointment_id = $1 AND a.patient_id = $2`,
    [appointmentId, patientId]
  );
  return rows[0] || null;
}

module.exports = {
  AppointmentError,
  isUuid,
  listDoctorsNearby,
  getDoctorProfile,
  getDoctorSlots,
  bookAppointment,
  listAppointmentsForPatient,
  getAppointmentForPatient,
};
