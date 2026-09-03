/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — Cloudinary upload helper
 * Stores patient-uploaded documents (lab reports / prescriptions — images or
 * PDFs) in Cloudinary; the returned secure_url is what gets saved as
 * medical_document.file_reference.
 * ========================================================================== */

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Uploads a buffer (image or PDF) to Cloudinary and resolves with the
// upload result (we mainly care about .secure_url). resource_type "auto"
// lets Cloudinary handle both images and PDFs correctly.
function uploadBuffer(buffer, { folder, filename } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder || 'trividha/medical_documents',
        resource_type: 'auto',
        filename_override: filename,
        use_filename: Boolean(filename),
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
