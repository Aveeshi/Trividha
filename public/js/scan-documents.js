/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — scan/upload documents page
 * Shows the picked filename, and disables the submit button + shows a
 * "processing" note once submitted (the OCR call can take several seconds).
 * ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("document-input");
  const box = document.getElementById("upload-box");
  const fileNameEl = document.getElementById("upload-file-name");
  const form = document.getElementById("upload-form");
  const submitBtn = document.getElementById("upload-submit-btn");
  const progressNote = document.getElementById("upload-progress-note");

  if (!input || !form) return;

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (file && fileNameEl) {
      fileNameEl.textContent = file.name;
      fileNameEl.hidden = false;
    }
  });

  // Basic drag-and-drop affordance onto the same label/input.
  if (box) {
    ["dragenter", "dragover"].forEach((evt) =>
      box.addEventListener(evt, (e) => {
        e.preventDefault();
        box.classList.add("is-dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      box.addEventListener(evt, (e) => {
        e.preventDefault();
        box.classList.remove("is-dragover");
      })
    );
    box.addEventListener("drop", (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event("change"));
      }
    });
  }

  form.addEventListener("submit", () => {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = getTranslation(getCurrentLanguage(), "uploading");
    }
    if (progressNote) progressNote.hidden = false;
  });
});
