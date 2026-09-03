/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — OCR pipeline HTTP client
 * Talks to the Python/FastAPI OCR engine in SIH/ (POST /process-document).
 * That service does its own OCR + Gemini extraction + normalization AND
 * writes the result straight into the `document_ocr` table — this client
 * just hands it the file and reports back what happened.
 * ========================================================================== */

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8000';

// Sends the uploaded file to the OCR engine for a given medical_document row.
// Returns the parsed response body on both success and (JSON) error replies,
// annotated with `ok` — callers decide what to do with a non-ok response.
// Throws only if the service is unreachable or replies with something that
// isn't JSON at all.
async function processDocument({ buffer, filename, mimeType, documentId, patientId }) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename || 'document');
  form.append('document_id', String(documentId));
  form.append('patient_id', String(patientId));

  const res = await fetch(`${OCR_SERVICE_URL}/process-document`, {
    method: 'POST',
    body: form,
  });

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new Error(`OCR service returned a non-JSON response (HTTP ${res.status}).`);
  }

  return { ok: res.ok, status: res.status, body };
}

module.exports = { processDocument, OCR_SERVICE_URL };
