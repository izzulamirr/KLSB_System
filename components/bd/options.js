export const BD_STAGE_OPTIONS = [
  "Budgetary",
  "Market Survey / Screening",
  "RFQ / ITQ / ITB / Sebut Harga",
  "Pre-Q",
  "RFP / Proposal",
  "Confidential Agreement (CA)",
];

export const BD_SCOPE_OPTIONS = [
  "Manpower Supply",
  "CyberSecurity",
  "Supply & Trading ICT",
  "Inspection",
  "Construction",
  "AWP",
  "Engineering Design",
  "Digitalization & ICT",
  "Event Management",
  "Consultation",
  "Software",
  "Others",
];

export const BD_STATUS_OPTIONS = [
  "PENDING",
  "DECLINED",
  "LOST",
  "WON",
  "CANCELLED",
  "ON-GOING",
];

// Only these statuses are still live enough to remind anyone about. Every other
// status (WON/LOST/DECLINED/CANCELLED) is a settled outcome. This mirrors the
// query in lib/reminderScheduler.js, which decides who actually gets emailed -
// keep the two in sync so the dashboard never shows a reminder that no email
// would ever be sent for.
export const BD_ACTIVE_STATUSES = ["PENDING", "ON-GOING"];
