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
  "FF": "faris@kemuncaklanai.com",
  "FAIZAL": "faizal@kemuncaklanai.com",
  "NH": "nh@kemuncaklanai.com",
  "IZZUL": "izzulamir@kemuncaklanai.com.my",
  "SS": "sabarudin.s@kemuncaklanai.com",
  "MHA": "hafiz.azizan@kemuncaklanai.com",
  "AMAD": "afiq@kemuncaklanai.com",
  "AKMAL": "akmal.haziq@kemuncaklanai.com.my",
};

export const PIC_DROPDOWN_OPTIONS = [
  "AAA",
  "AHA",
  "AKMAL",
  "AMAD",
  "ASMS",
  "FAS",
  "FF",
  "MFR",
  "MHA",
  "NH",
  "NZA",
  "SOBRY",
  "SS",
  "SR",
  "IZZUL",
];

function normalizeRecipientValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const emailMatch = trimmed.match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }

  return trimmed.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

/**
 * Get email address for a PIC code
 * @param {string} picCode - The PIC initials/code
 * @returns {string|null} Email address or null if not found
 */
export function getPicEmail(picCode) {
  if (!picCode) return null;
  const normalized = normalizeRecipientValue(picCode);
  if (!normalized) return null;

  const directMatch = PIC_EMAIL_MAP[normalized];
  if (directMatch) return directMatch;

  const compactNormalized = normalized.replace(/[^A-Z0-9]/g, "");
  if (!compactNormalized) return null;

  for (const [code, email] of Object.entries(PIC_EMAIL_MAP)) {
    if (code.replace(/[^A-Z0-9]/g, "") === compactNormalized) {
      return email;
    }
  }

  return null;
}

/**
 * Get email addresses for multiple PIC codes
 * @param {string|string[]} picCodes - Comma-separated string or array of PIC codes
 * @returns {string[]} Array of email addresses
 */
export function getPicEmails(picCodes) {
  if (!picCodes) return [];

  const codes = Array.isArray(picCodes) ? picCodes : parsePicString(picCodes);

  return [
    ...new Set(
      codes
        .map((value) => normalizeRecipientValue(value))
        .filter(Boolean)
        .map((value) => (value.includes("@") ? value : getPicEmail(value)))
        .filter(Boolean)
    ),
  ];
}

/**
 * Normalize a PIC value for display or storage.
 * Always returns comma-separated, deduplicated PIC codes.
 * @param {string|string[]} picValue
 * @returns {string}
 */
export function formatPicString(picValue) {
  if (!picValue) return "";
  const codes = Array.isArray(picValue) ? picValue : parsePicString(picValue);
  return codes.map((code) => normalizeRecipientValue(code)).filter(Boolean).join(", ");
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
  const normalized = String(picString).replace(/[\/;&\n]+/g, ",");
  const pieces = normalized
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((code) => normalizeRecipientValue(code));

  return [...new Set(pieces)];
}

/**
 * Convert array of PIC codes to comma-separated string
 * @param {string[]} picArray - Array of PIC codes
 * @returns {string} Comma-separated PIC codes
 */
export function picArrayToString(picArray) {
  if (!Array.isArray(picArray)) return "";
  return picArray.map((c) => normalizeRecipientValue(c)).filter(Boolean).join(", ");
}
