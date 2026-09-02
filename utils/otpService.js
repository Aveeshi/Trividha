/* ============================================================================
 * TRIVIDHA HOSPITAL KIOSK — demo OTP service
 *
 * Sends OTPs to the fixed demo recipient list in config/demoOtpRecipients.js
 * via Twilio VERIFY, since the real sandbox.abdm.gov.in Aadhaar/ABHA OTP API
 * isn't wired up yet. Replace this whole module with the ABDM sandbox call
 * once that key exists.
 *
 * Why Verify and not a plain SMS (client.messages.create)? A Twilio trial
 * account can't send a free-form SMS body to an Indian number — carriers
 * there require a pre-registered (DLT) template, and trial accounts don't
 * have one. Twilio Verify sidesteps this: it uses Twilio's own pre-approved
 * "Your ... verification code is: 123456" template, which trial accounts
 * ARE allowed to use, and it manages the code + its expiry itself (10
 * minutes by default — matches what we want).
 *
 * The one thing this costs us: each recipient's code is generated
 * independently by Twilio, so the 6 demo phones don't all receive the exact
 * same digits. That's fine here — checkOtp() just asks Twilio to check the
 * typed code against every recipient and accepts it if any one of them
 * approves, so whichever of the 6 phones you look at still works.
 *
 * NOTE: trial accounts also only deliver to numbers added as "Verified
 * Caller IDs" in the Twilio console (console.twilio.com/us1/develop/phone-numbers/manage/verified)
 * — add all 6 demo numbers there, or sends to unverified ones will fail
 * with error 21608 regardless of this module being otherwise correct.
 * ========================================================================== */

const DEMO_OTP_RECIPIENTS = require('../config/demoOtpRecipients');

let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error(
      'Twilio is not configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.'
    );
  }
  twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

function getVerifyService() {
  const client = getTwilioClient();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID is not set in .env.');
  }
  return client.verify.v2.services(serviceSid);
}

// Kicks off a Twilio Verify SMS OTP to every demo recipient. Failures for
// individual numbers are logged but don't stop the others going out — this
// is a demo aid, not the real ABDM flow, so we're lenient about it.
async function sendOtpSms() {
  const service = getVerifyService();

  const results = await Promise.allSettled(
    DEMO_OTP_RECIPIENTS.map((to) => service.verifications.create({ to, channel: 'sms' }))
  );

  const failures = results
    .map((r, i) => ({ r, to: DEMO_OTP_RECIPIENTS[i] }))
    .filter(({ r }) => r.status === 'rejected');

  failures.forEach(({ r, to }) => {
    console.error(`otpService.sendOtpSms: failed to text ${to}:`, r.reason && r.reason.message);
  });

  if (failures.length === DEMO_OTP_RECIPIENTS.length) {
    // Every single send failed — that's not "a couple of demo phones are
    // off", that's Twilio/config broken (or none of the 6 are verified
    // caller IDs on this trial account yet). Surface it.
    throw new Error('Could not send the OTP to any demo recipient.');
  }

  return { sent: DEMO_OTP_RECIPIENTS.length - failures.length, failed: failures.length };
}

// Checks the code the user typed against every demo recipient (we don't
// know which of the 6 phones they actually looked at). True if any of them
// comes back "approved"; false for a wrong code, an expired one, or no
// pending verification at all.
async function checkOtp(code) {
  const service = getVerifyService();

  const results = await Promise.allSettled(
    DEMO_OTP_RECIPIENTS.map((to) => service.verificationChecks.create({ to, code }))
  );

  return results.some((r) => r.status === 'fulfilled' && r.value.status === 'approved');
}

module.exports = { sendOtpSms, checkOtp };
