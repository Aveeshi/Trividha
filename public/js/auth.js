/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — auth pages
 * Aadhaar/ABHA mutual exclusivity + OTP box auto-advance.
 * ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initIdentifierToggle();
  initOtpBoxes();
});

// On the Aadhaar/ABHA identify form: filling one field disables the other,
// since a patient should only submit one identifier at a time.
function initIdentifierToggle() {
  const aadhaar = document.getElementById("aadhaar");
  const abha = document.getElementById("abha");
  if (!aadhaar || !abha) return;

  aadhaar.addEventListener("input", () => {
    aadhaar.value = aadhaar.value.replace(/\D/g, "");
    abha.disabled = aadhaar.value.length > 0;
  });
  abha.addEventListener("input", () => {
    abha.value = abha.value.replace(/\D/g, "");
    aadhaar.disabled = abha.value.length > 0;
  });
}

// Auto-advances focus across the 6 OTP boxes and combines their digits
// into the hidden #otp-hidden field before submit.
function initOtpBoxes() {
  const boxes = document.querySelectorAll("#otp-boxes .otp-box");
  const hidden = document.getElementById("otp-hidden");
  const form = document.getElementById("otp-form");
  if (!boxes.length || !hidden || !form) return;

  boxes[0].focus();

  boxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      if (box.value && boxes[i + 1]) boxes[i + 1].focus();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus();
    });
  });

  form.addEventListener("submit", () => {
    hidden.value = Array.from(boxes).map((b) => b.value).join("");
  });
}
