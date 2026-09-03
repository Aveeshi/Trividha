/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — medical_document / document_ocr model
 * Column names match the DB exactly (see information_schema).
 * Note: the OCR pipeline (SIH/) writes document_ocr itself — this module
 * only ever reads that table, never writes it.
 * ========================================================================== */

const pool = require('./db');

async function create({ patientId, sourceType, documentType, fileReference, documentDate, ocrStatus }) {
  const { rows } = await pool.query(
    `INSERT INTO medical_document
       (patient_id, source_type, document_type, file_reference, document_date, ocr_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [patientId, sourceType, documentType || null, fileReference, documentDate || null, ocrStatus || 'PENDING']
  );
  return rows[0];
}

async function updateOcrStatus(documentId, ocrStatus, documentType) {
  const { rows } = await pool.query(
    `UPDATE medical_document
        SET ocr_status = $2,
            document_type = COALESCE($3, document_type)
      WHERE document_id = $1
      RETURNING *`,
    [documentId, ocrStatus, documentType || null]
  );
  return rows[0] || null;
}

async function findById(documentId) {
  const { rows } = await pool.query('SELECT * FROM medical_document WHERE document_id = $1', [documentId]);
  return rows[0] || null;
}

// All of a patient's uploaded documents, newest first, each left-joined with
// its OCR result (if processing has finished).
async function findAllByPatient(patientId) {
  const { rows } = await pool.query(
    `SELECT
        md.document_id, md.patient_id, md.source_type, md.document_type,
        md.file_reference, md.document_date, md.uploaded_at, md.ocr_status,
        md.verified_by_doctor, md.verified_at,
        docr.extracted_text, docr.structured_data, docr.confidence, docr.processed_at
     FROM medical_document md
     LEFT JOIN document_ocr docr ON docr.document_id = md.document_id
     WHERE md.patient_id = $1
     ORDER BY md.uploaded_at DESC`,
    [patientId]
  );
  return rows;
}

// One document (with its OCR result), scoped to a patient so a patient can
// never look up another patient's document by guessing an id.
async function findByIdForPatient(documentId, patientId) {
  const { rows } = await pool.query(
    `SELECT
        md.document_id, md.patient_id, md.source_type, md.document_type,
        md.file_reference, md.document_date, md.uploaded_at, md.ocr_status,
        md.verified_by_doctor, md.verified_at,
        docr.extracted_text, docr.structured_data, docr.confidence, docr.processed_at
     FROM medical_document md
     LEFT JOIN document_ocr docr ON docr.document_id = md.document_id
     WHERE md.document_id = $1 AND md.patient_id = $2`,
    [documentId, patientId]
  );
  return rows[0] || null;
}

module.exports = { create, updateOcrStatus, findById, findAllByPatient, findByIdForPatient };
