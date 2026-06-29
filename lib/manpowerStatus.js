// Pure date/status helpers shared between the client-side ManpowerTable and
// the server-rendered manpower dashboard page, so both compute the same
// "effective" status for a row instead of drifting apart. No Node-only
// imports here — this file is bundled for the browser too.

// Dates are stored as plain "YYYY-MM-DD" strings; `new Date(str)` reads that
// as UTC midnight, which shifts the local day for timezones behind UTC.
// Parse the year/month/day directly and build a local-time Date instead.
export function parseIsoDateLocal(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isEndDateExceeded(endDateKlsb) {
  const end = parseIsoDateLocal(endDateKlsb);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

export function isRegularEndDateExceeded(endDate) {
  const end = parseIsoDateLocal(endDate);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

export function computeStatusColorFromDates(row) {
  const klsbExpired = isEndDateExceeded(row.END_DATE_KLSB);
  const endDateExpired = isRegularEndDateExceeded(row.END_DATE);

  // If both dates exceeded → Terminated
  if (klsbExpired && endDateExpired) {
    return "Terminated";
  }
  // If KLSB end date exceeded but END_DATE not yet exceeded → Pending
  if (klsbExpired && !endDateExpired) {
    return "Pending";
  }
  // If END_DATE exceeded (but not KLSB) → Completed
  if (endDateExpired) {
    return "Completed";
  }
  // Default to Active if no dates exceeded
  return row.STATUS_COLOR || "Active";
}

// The "effective" status a row should be counted/displayed under: an
// explicit STATUS_COLOR wins, otherwise fall back to the date-derived value.
export function effectiveStatusColor(row) {
  return row?.STATUS_COLOR || computeStatusColorFromDates(row) || row?.STATUS || "";
}
