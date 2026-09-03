import PDFDocument from 'pdfkit';
import { v2 as cloudinary } from 'cloudinary';
import { supabase } from '../config/supabase.js';
import { doctorModel, doctorService } from '../models/doctorModel.js';
import { patientModel, patientService } from '../models/patientModel.js';
import { hospitalModel, hospitalService } from '../models/hospitalModel.js';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper: generate PDF into a Buffer
function buildPDFBuffer(pres, doctor, patient, hospital) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text(hospital ? hospital.name : 'Trividha Clinic', { align: 'center' });
    doc.fontSize(10).text('Official Medical Prescription', { align: 'center' });
    doc.moveDown(2);

    // Doctor Details
    doc.fontSize(12).text(`Doctor: ${doctor.name}`);
    doc.fontSize(10).text(`Specialization: ${doctor.specialization}`);
    doc.text(`Reg No: ${doctor.government_doctor_id}`);
    doc.moveDown();

    // Patient Details
    doc.text(`Patient: ${patient.name} (Age: ${patient.age}, ${patient.gender})`);
    doc.text(`Date: ${new Date(pres.created_at).toLocaleDateString()}`);
    doc.moveDown(2);

    // Rx Section
    doc.fontSize(16).text('Rx', { underline: true });
    doc.moveDown();

    pres.prescription_item.forEach((item, index) => {
      doc.fontSize(12).text(`${index + 1}. ${item.medicine_name}`);
      doc.fontSize(10).text(`   Dosage: ${item.dosage} | Frequency: ${item.frequency} | Duration: ${item.duration}`);
      if (item.instructions) {
        doc.text(`   Instructions: ${item.instructions}`);
      }
      doc.moveDown();
    });

    doc.moveDown(4);
    doc.fontSize(10).text('Signature: _______________________', { align: 'right' });
    doc.text(doctor.name, { align: 'right' });

    doc.end();
  });
}

// Helper: upload buffer to Cloudinary
function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'prescriptions',
        public_id: filename,
        resource_type: 'raw',
        format: 'pdf'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export const generatePrescriptionPDF = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if we already have a stored PDF
    const { data: pres, error } = await supabase
      .from('prescription')
      .select('*, prescription_item(*)')
      .eq('prescription_id', id)
      .single();

    if (error || !pres) return res.status(404).send('Prescription not found');

    // If already uploaded to Cloudinary, just redirect
    if (pres.pdf_url) {
      return res.redirect(pres.pdf_url);
    }

    const doctor = await doctorService.getDoctorById(pres.doctor_id);
    const patient = await patientService.getPatientById(pres.patient_id);
    const hospital = await hospitalService.getHospitalById(pres.hospital_id);

    // 1. Generate PDF buffer
    const pdfBuffer = await buildPDFBuffer(pres, doctor, patient, hospital);

    // 2. Upload to Cloudinary
    const filename = `prescription_${id}_${patient.name.replace(/ /g, '_')}`;
    const cloudinaryUrl = await uploadToCloudinary(pdfBuffer, filename);

    // 3. Save URL to Supabase
    await supabase
      .from('prescription')
      .update({ pdf_url: cloudinaryUrl })
      .eq('prescription_id', id);

    // 4. Redirect browser to Cloudinary URL (triggers download)
    res.redirect(cloudinaryUrl);

  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
};
