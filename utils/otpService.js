/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — demo OTP service (Twilio disabled)
 *
 * Twilio Verify SMS is disabled for now — the trial account's rate/volume
 * limits made the OTP flow unreliable for demo purposes. Until the real
 * sandbox.abdm.gov.in Aadhaar/ABHA OTP API is wired up, this stub replaces
 * it: sendOtpSms() is a no-op (no SMS is actually sent) and checkOtp()
 * accepts any code for any Aadhaar/ABHA ID.
 *
 * To restore real OTP delivery later, reinstate the Twilio Verify calls
 * here (see git history for the previous implementation) and swap this
 * stub out.
 * ========================================================================== */

// No-op: nothing is actually sent. Kept async or the callers' try/catch
// around it stay meaningful.
async function sendOtpSms() {
  return { sent: 0, failed: 0 };
}

// Accepts any non-empty code — OTP verification is bypassed for now.
async function checkOtp(code) {
  return Boolean(code);
}

module.exports = { sendOtpSms, checkOtp };
