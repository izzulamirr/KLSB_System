/**
 * PIC (Person In Charge) to Email mapping for reminder notifications
 * Maps PIC initials/codes to their email addresses
 */

export const PIC_EMAIL_MAP = {
  "SR": "Shazli.r@kemuncaklanai.com",
  "ASMS": "syahmy.s@kemuncaklanai.com",
  "FAS": "fivi.s@kemuncaklanai.com",
  "AHA": "aha@kemuncaklanai.com",
  "IKA": "haziqah@kemuncaklanai.com",
  "NZA": "Nazmi.zainul@kemuncaklanai.com",
  "MFR": "mfaizal@kemuncaklanai.com",
  "SOBRY": "Sobry.s@kemuncaklanai.com",
  "AAA": "Asrul@kemuncaklanai.com.my",
  "MAR": "rauf@kemuncaklanai.com",
  "ABE": "abe@kemuncaklanai.com",
  "OD": "OD@kemuncaklanai.com",
  "FF": "ff@kemuncaklanai.com",
  "FAIZAL": "faizal@kemuncaklanai.com",
  "NH": "nh@kemuncaklanai.com",
  "ISMA": "isma@kemuncaklanai.com",
  "ED": "ed@kemuncaklanai.com",
  "SS": "ss@kemuncaklanai.com",
};

/**
 * Get email address for a PIC code
 * @param {string} picCode - The PIC initials/code
 * @returns {string|null} Email address or null if not found
 */
export function getPicEmail(picCode) {
  if (!picCode) return null;
  const normalized = String(picCode).trim().toUpperCase();
  return PIC_EMAIL_MAP[normalized] || null;
}

/**
 * Get email addresses for multiple PIC codes
 * @param {string|string[]} picCodes - Comma-separated string or array of PIC codes
 * @returns {string[]} Array of email addresses
 */
export function getPicEmails(picCodes) {
  if (!picCodes) return [];
  const codes = Array.isArray(picCodes)
    ? picCodes
    : String(picCodes)
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
  return codes
    .map((code) => getPicEmail(code))
    .filter(Boolean);
}

/**
 * Get all PIC codes and their emails
 * @returns {Object} Map of PIC code to email
 */
export function getAllPicEmails() {
  return { ...PIC_EMAIL_MAP };
}

/**
 * Parse PIC codes from string to array
 * @param {string} picString - Comma-separated PIC codes
 * @returns {string[]} Array of PIC codes
 */
export function parsePicString(picString) {
  if (!picString) return [];
  return String(picString)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Convert array of PIC codes to comma-separated string
 * @param {string[]} picArray - Array of PIC codes
 * @returns {string} Comma-separated PIC codes
 */
export function picArrayToString(picArray) {
  if (!Array.isArray(picArray)) return "";
  return picArray.map((c) => String(c).trim()).filter(Boolean).join(", ");
}
