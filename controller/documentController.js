/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — patient document upload / OCR controller
 *
 * Flow for "Scan / Upload Documents":
 *   1. File comes in via multer (memory buffer) — image (JPEG/PNG) or PDF.
 *   2. Upload the buffer to Cloudinary -> secure_url.
 *   3. Insert a medical_document row (ocr_status = PROCESSING) pointing at
 *      that Cloudinary URL.
 *   4. Hand the same buffer to the OCR pipeline (SIH/, a separate FastAPI
 *      service) along with the new document_id + patient_id. That service
 *      does OCR + Gemini extraction + normalization and writes the result
 *      into `document_ocr` itself — we don't touch that table.
 *   5. Flip medical_document.ocr_status to COMPLETED/FAILED based on how
 *      the OCR call went, and stamp document_type from its classification.
 * ========================================================================== */

const documentModel = require('../model/document');
const { uploadBuffer } = require('../utils/cloudinary');
const { processDocument } = require('../utils/ocrClient');
const { buildAccount } = require('./patientController');

function showScanDocuments(req, res) {
  return res.render('patient/scan-documents', {
    account: buildAccount(req.patient),
    error: null,
  });
}

async function uploadDocument(req, res) {
  const account = buildAccount(req.patient);

  if (!req.file) {
    return res.render('patient/scan-documents', {
      account,
      error: 'Choose an image (JPEG/PNG) or PDF to upload.',
    });
  }

  const { buffer, originalname, mimetype } = req.file;
  let document;

  try {
    const uploadResult = await uploadBuffer(buffer, {
      folder: `trividha/medical_documents/${req.patient.patient_id}`,
      filename: originalname,
    });

    document = await documentModel.create({
      patientId: req.patient.patient_id,
      sourceType: 'PATIENT_UPLOAD',
      fileReference: uploadResult.secure_url,
      ocrStatus: 'PROCESSING',
    });
  } catch (err) {
    console.error('documentController.uploadDocument: upload/insert failed:', err);
    return res.render('patient/scan-documents', {
      account,
      error: 'Could not upload your document. Please try again.',
    });
  }

  // The document is safely stored either way at this point (Cloudinary +
  // medical_document row) — from here on, a failure just means OCR didn't
  // complete, not that the upload was lost. Reflect that in ocr_status
  // rather than showing the patient an error for something that "worked".
  try {
    const result = await processDocument({
      buffer,
      filename: originalname,
      mimeType: mimetype,
      documentId: document.document_id,
      patientId: req.patient.patient_id,
    });

    if (result.ok) {
      await documentModel.updateOcrStatus(document.document_id, 'COMPLETED', result.body.document_type);
    } else {
      console.error('documentController.uploadDocument: OCR pipeline error:', result.status, result.body);
      await documentModel.updateOcrStatus(document.document_id, 'FAILED');
    }
  } catch (err) {
    console.error('documentController.uploadDocument: OCR pipeline unreachable:', err);
    await documentModel.updateOcrStatus(document.document_id, 'FAILED');
  }

  return res.redirect(`/patient/dashboard/documents?uploaded=${document.document_id}`);
}

async function listDocuments(req, res) {
  try {
    const documents = await documentModel.findAllByPatient(req.patient.patient_id);
    const uploadedId = req.query.uploaded ? parseInt(req.query.uploaded, 10) : null;

    return res.render('patient/documents', {
      account: buildAccount(req.patient),
      documents,
      uploadedId,
    });
  } catch (err) {
    console.error('documentController.listDocuments error:', err);
    return res.status(500).send('Something went wrong.');
  }
}

module.exports = { showScanDocuments, uploadDocument, listDocuments };
