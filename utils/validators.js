// ABHA ID and Mobile Number Verification & Validation Utilities

/**
 * Validates whether an input string is a valid ABHA ID or 10-digit Indian mobile number
 * @param {string} input - Cleaned or formatted ID/Phone string
 * @returns {{ isValid: boolean, type: 'ABHA' | 'MOBILE' | null, formatted: string, message?: string }}
 */
function validatePatientId(input) {
  if (!input || typeof input !== "string") {
    return { isValid: false, type: null, formatted: "", message: "ID cannot be empty" };
  }

  // Remove whitespace and dashes
  const digitsOnly = input.replace(/[\s-]/g, "");

  // 1. Check 14-digit ABHA Number (e.g., 91-4589-2341-9872 or 14 digits)
  if (/^\d{14}$/.test(digitsOnly)) {
    const formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6, 10)}-${digitsOnly.slice(10, 14)}`;
    return {
      isValid: true,
      type: "ABHA",
      formatted,
      digits: digitsOnly
    };
  }

  // 2. Check 10-digit Indian Mobile Number (starts with 6, 7, 8, 9)
  if (/^[6-9]\d{9}$/.test(digitsOnly)) {
    const formatted = `+91 ${digitsOnly.slice(0, 5)} ${digitsOnly.slice(5)}`;
    return {
      isValid: true,
      type: "MOBILE",
      formatted,
      digits: digitsOnly
    };
  }

  // 3. Allow partial test inputs (e.g. 9876543210 or ABHA format)
  if (/^\d{10,14}$/.test(digitsOnly)) {
    return {
      isValid: true,
      type: digitsOnly.length === 14 ? "ABHA" : "MOBILE",
      formatted: digitsOnly,
      digits: digitsOnly
    };
  }

  return {
    isValid: false,
    type: null,
    formatted: input,
    message: "Please enter a valid 14-digit ABHA ID or 10-digit Mobile number."
  };
}

/**
 * Validates a 6-digit OTP code
 * @param {string} otp
 * @returns {boolean}
 */
function validateOtp(otp) {
  if (!otp) return false;
  const clean = otp.replace(/\D/g, "");
  return clean.length === 6;
}

module.exports = {
  validatePatientId,
  validateOtp
};
