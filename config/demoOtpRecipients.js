/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — demo OTP recipients
 *
 * We don't have the sandbox.abdm.gov.in API key yet, so real Aadhaar/ABHA-
 * linked SMS delivery isn't wired up. For the demo, every OTP — regardless
 * of which Aadhaar/ABHA ID was entered — is texted to this fixed list of
 * numbers via Twilio instead. Swap this file out once the ABDM sandbox key
 * is available and OTPs should go to the patient's actual linked mobile.
 * ========================================================================== */

// Assumed +91 (India) since all numbers were given as 10-digit numbers.
const DEMO_OTP_RECIPIENTS = [
  '+919049157272',
  '+919359308330',
];

module.exports = DEMO_OTP_RECIPIENTS;
