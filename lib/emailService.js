/**
 * Email Service for sending notifications and reminders
 * Uses SMTP via nodemailer for reliable email delivery
 */

import "dotenv/config";
import nodemailer from "nodemailer";

const PORTAL_BASE_URL = (process.env.PORTAL_URL || "https://portal.kemuncaklanai.com").replace(/\/$/, "");
const EMAIL_THEME = {
  pageBg: "#2f3238",
  headerBg: "#3f5f7f",
  headerBorder: "#35506a",
  contentText: "#2d3748",
  mutedText: "#5b6678",
  panelBorder: "#d7dde8",
  panelBg: "#ffffff",
  softBg: "#f3f5f9",
  softBorder: "#cfd7e4",
  accent: "#2f66b1",
  accentDark: "#25508d",
  footerBg: "#e9edf3",
};

// Cached transporter instance
let transporter = null;
/**
 * Initialize email transporter (nodemailer)
 * @returns {Object} Configured transporter
 */
function getTransporter() {
  if (transporter) return transporter;

  // Check for required SMTP configuration
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    throw new Error(
      'Missing SMTP configuration. Please set: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS'
    );
  }

  // Handle escaped dollar signs in password (e.g., \\$123 -> $123)
  const password = smtpPass.replace(/\\\$/g, '$');

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: password,
    },
  });

  return transporter;
}

function getProposalEditUrl(proposal) {
  const proposalId = proposal?.id || proposal?.proposalId || "";
  if (!proposalId) {
    return `${PORTAL_BASE_URL}/bd/proposals`;
  }

  const returnTo = encodeURIComponent("/bd/proposals");
  return `${PORTAL_BASE_URL}/bd/proposals/${encodeURIComponent(proposalId)}/edit?returnTo=${returnTo}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function portalLink(path) {
  if (!path) return PORTAL_BASE_URL;
  return `${PORTAL_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function moneyText(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return escapeHtml(value);

  return escapeHtml(
    new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric)
  );
}

function rowHtml(label, value) {
  return `
    <div style="display:flex;gap:12px;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid ${EMAIL_THEME.softBorder};">
      <div style="color:${EMAIL_THEME.headerBg};font-size:13px;font-weight:600;flex:1;">${escapeHtml(label)}</div>
      <div style="color:${EMAIL_THEME.contentText};font-size:13px;text-align:right;flex:1;">${value}</div>
    </div>
  `;
}

function rowsCard(rows) {
  return `
    <div style="border:1px solid ${EMAIL_THEME.softBorder};background:${EMAIL_THEME.softBg};">
      <div style="background:${EMAIL_THEME.panelBg};border:1px solid ${EMAIL_THEME.panelBorder};">
        ${rows.join("")}
      </div>
    </div>
  `;
}

function badgeHtml(text, accent = EMAIL_THEME.accent) {
  return `
    <div style="display:inline-block;background:${accent};color:#fff;padding:6px 10px;border-radius:2px;font-size:11px;font-weight:700;letter-spacing:.04em;">
      ${escapeHtml(text)}
    </div>
  `;
}

function emailShell({ title, introHtml, bodyHtml, actionLabel, actionHref, footerText, noteHtml = "", accent = EMAIL_THEME.accent, accentDark = EMAIL_THEME.accentDark }) {
  const actionBlock = actionLabel && actionHref
    ? `
      <div style="margin-top:18px;padding:18px;background:${EMAIL_THEME.softBg};border-left:4px solid ${accent};">
        <div style="font-size:14px;line-height:1.7;color:${EMAIL_THEME.mutedText};margin-bottom:14px;">${noteHtml}</div>
        <a href="${actionHref}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 20px;border-radius:2px;">${escapeHtml(actionLabel)}</a>
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.pageBg};font-family:Segoe UI,Tahoma,Arial,sans-serif;color:${EMAIL_THEME.contentText};">
  <div style="padding:24px 0;background:${EMAIL_THEME.pageBg};">
    <div style="max-width:560px;margin:0 auto;background:${EMAIL_THEME.panelBg};border:1px solid ${EMAIL_THEME.panelBorder};">
      <div style="background:${EMAIL_THEME.headerBg};color:#fff;text-align:center;padding:34px 28px;border-bottom:4px solid ${EMAIL_THEME.headerBorder};">
        <div style="font-size:24px;line-height:1.2;font-weight:700;">${escapeHtml(title)}</div>
        <div style="margin-top:8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.9;">KLSB Portal System</div>
      </div>
      <div style="padding:28px;background:${EMAIL_THEME.panelBg};">
        ${introHtml ? `<div style="font-size:14px;line-height:1.7;color:${EMAIL_THEME.mutedText};margin-bottom:22px;">${introHtml}</div>` : ""}
        ${bodyHtml || ""}
        ${actionBlock}
        ${footerText ? `<div style="margin-top:22px;font-size:13px;line-height:1.7;color:${EMAIL_THEME.mutedText};">${footerText}</div>` : ""}
        <div style="margin-top:18px;font-size:13px;line-height:1.6;color:${EMAIL_THEME.contentText};"><strong>KLSB Portal System</strong></div>
      </div>
      <div style="background:${EMAIL_THEME.footerBg};text-align:center;padding:16px 22px;font-size:11px;line-height:1.5;color:#778190;border-top:1px solid ${EMAIL_THEME.panelBorder};">
        This is an automated email from the KLSB Portal. Please do not reply to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function verificationCodeHtml(code, ttlMinutes) {
  return `
    <div style="background:${EMAIL_THEME.softBg};border:1px solid ${EMAIL_THEME.softBorder};padding:18px;text-align:center;">
      <div style="font-size:28px;line-height:1;font-weight:800;letter-spacing:8px;color:${EMAIL_THEME.headerBg};">${escapeHtml(code)}</div>
      <div style="margin-top:10px;font-size:12px;color:${EMAIL_THEME.mutedText};">Expires in ${ttlMinutes} minutes</div>
    </div>
  `;
}

/**
 * Send email to recipients
 * @param {Object} options Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email body
 * @param {string} options.text - Plain text email body (optional)
 * @returns {Promise<Object>} Sending result
 */
export async function sendEmail(options) {
  const { to, subject, html, text } = options;

  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, html');
  }

  const recipients = Array.isArray(to) ? to : [to];
  // Prefer SendGrid API if configured (no SMTP required)
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromAddress = process.env.SMTP_FROM || process.env.SENDGRID_FROM || process.env.SMTP_USER;

  if (sendgridKey) {
    try {
      const payload = {
        personalizations: [
          {
            to: recipients.map((r) => ({ email: r })),
            subject,
          },
        ],
        from: { email: fromAddress || 'no-reply@example.com' },
        content: [
          { type: 'text/html', value: html },
          { type: 'text/plain', value: text || subject },
        ],
      };

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`SendGrid error: ${res.status} ${body}`);
      }

      console.log(`[EMAIL SENT via SendGrid] To: ${recipients.join(', ')}`);
      return { success: true, recipients, subject };
    } catch (err) {
      console.error(`[EMAIL ERROR] SendGrid failed for ${recipients.join(', ')}:`, err.message || err);
      // fallback to SMTP below
    }
  }

  // Fallback to SMTP transporter
  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from: fromAddress,
      to: recipients,
      subject,
      html,
      text: text || subject,
    });

    console.log(`[EMAIL SENT via SMTP] To: ${recipients.join(', ')}`);
    return { success: true, recipients, subject, messageId: result.messageId };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${recipients.join(', ')}:`, error.message || error);
    throw error;
  }
}

/**
 * Send proposal creation notification to PIC
 * @param {Object} proposal - Proposal data
 * @param {string[]} picEmails - Array of PIC email addresses
 * @returns {Promise<Object>}
 */
export async function sendProposalCreationEmail(proposal, picEmails) {
  if (!picEmails || picEmails.length === 0) {
    throw new Error("No PIC emails provided");
  }

  const {
    refNo = "",
    titleProjectName = "",
    client = "",
    deadline = "",
    maturityOnDate = "",
    valueRM = "",
    personInCharge = "",
  } = proposal;

  const htmlContent = emailShell({
    title: "New Proposal Notification",
    introHtml: `Dear ${escapeHtml(personInCharge)},<br><br>A new proposal has been created and assigned to you. Please review the proposal details and take appropriate action in the portal.`,
    bodyHtml: `
      <div style="margin:22px 0 12px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${EMAIL_THEME.headerBg};">Proposal Information</div>
      ${rowsCard([
        rowHtml("Reference No.", `<strong>${escapeHtml(refNo || "—")}</strong>`),
        rowHtml("Title / Project", escapeHtml(titleProjectName || "—")),
        rowHtml("Client", escapeHtml(client || "—")),
        rowHtml("Value (RM)", `<strong>${moneyText(valueRM)}</strong>`),
        rowHtml("Deadline", `<strong>${escapeHtml(deadline || "—")}</strong>`),
        rowHtml("Maturity Date", `<strong>${escapeHtml(maturityOnDate || "—")}</strong>`),
      ])}
    `,
    actionLabel: "View Proposal",
    actionHref: portalLink("/bd/proposals"),
    noteHtml: "Access the portal to view complete details, update status, and manage proposal activities.",
    footerText: "If you require further information or assistance regarding this proposal, please contact the Business Development team.",
  });

  const textContent = `
NEW PROPOSAL NOTIFICATION

Dear ${personInCharge},

A new proposal has been created and assigned to you. Please review the proposal details and take appropriate action in the portal.

PROPOSAL INFORMATION
---
Reference No.: ${refNo || "—"}
Title / Project: ${titleProjectName || "—"}
Client: ${client || "—"}
Value (RM): ${valueRM ? new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(valueRM) : "—"}
Deadline: ${deadline || "—"}
Maturity Date: ${maturityOnDate || "—"}

Access the portal to view complete details and manage proposal activities:
${portalLink("/bd/proposals")}

---
If you require further information regarding this proposal, please contact the Business Development team.

Yours sincerely,
KLSB Portal System

This is an automated email from the KLSB Portal. Please do not reply to this email.
  `.trim();

  return await sendEmail({
    to: picEmails,
    subject: `New Proposal Created - ${refNo} (${titleProjectName})`,
    html: htmlContent,
    text: textContent,
  });
}

/**
 * Send maturation date reminder email
 * @param {Object} proposal - Proposal data
 * @param {string[]} picEmails - Array of PIC email addresses
 * @param {number} daysRemaining - Days until maturation
 * @returns {Promise<Object>}
 */
export async function sendMaturationReminder(proposal, picEmails, daysRemaining) {
  if (!picEmails || picEmails.length === 0) {
    throw new Error("No PIC emails provided");
  }

  const {
    id = "",
    refNo = "",
    titleProjectName = "",
    maturityOnDate = "",
    personInCharge = "",
  } = proposal;
  const editUrl = getProposalEditUrl({ ...proposal, id });

  const urgency =
    daysRemaining === 0
      ? "TODAY"
      : daysRemaining <= 3
        ? "URGENT"
        : daysRemaining <= 7
          ? "UPCOMING"
          : "REMINDER";

  const htmlContent = emailShell({
    title: "Proposal Maturation Reminder",
    introHtml: `Dear ${escapeHtml(personInCharge)},<br><br>This is a reminder that a proposal under your charge is approaching its maturation date. Please review the details below and ensure all required actions are completed.`,
    bodyHtml: `
      <div style="margin-bottom:12px;">${badgeHtml(`${urgency} - ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`, "#c2410c")}</div>
      <div style="margin:22px 0 12px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${EMAIL_THEME.headerBg};">Proposal Information</div>
      ${rowsCard([
        rowHtml("Reference No.", `<strong>${escapeHtml(refNo || "—")}</strong>`),
        rowHtml("Title / Project", escapeHtml(titleProjectName || "—")),
        rowHtml("Maturity Date", `<strong>${escapeHtml(maturityOnDate || "—")}</strong>`),
      ])}
    `,
    actionLabel: "Update Status",
    actionHref: editUrl,
    noteHtml: "Access the portal to review the proposal status and ensure all required follow-ups and actions are completed before the maturation date.",
    footerText: "For further assistance regarding this proposal, please contact the Business Development team.",
    accent: "#c2410c",
    accentDark: "#a03008",
  });

  const textContent = `
PROPOSAL MATURATION REMINDER — ${urgency}

Dear ${personInCharge},

This is a reminder that a proposal under your charge is approaching its maturation date.

Time Remaining: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}

PROPOSAL INFORMATION
---
Reference No.: ${refNo || "—"}
Title / Project: ${titleProjectName || "—"}
Maturity Date: ${maturityOnDate || "—"}

Please ensure all required follow-ups and actions are completed before the maturation date. Access the portal to review status:
${editUrl}

---
For further assistance, please contact the Business Development team.

Yours sincerely,
KLSB Portal System

This is an automated email from the KLSB Portal. Please do not reply to this email.
  `.trim();

  return await sendEmail({
    to: picEmails,
    subject: `${urgency} Proposal Maturation Reminder - ${refNo}`,
    html: htmlContent,
    text: textContent,
  });
}

/**
 * Send deadline reminder email
 * @param {Object} proposal - Proposal data
 * @param {string[]} picEmails - Array of PIC email addresses
 * @param {number} daysRemaining - Days until deadline
 * @returns {Promise<Object>}
 */
export async function sendDeadlineReminder(proposal, picEmails, daysRemaining) {
  if (!picEmails || picEmails.length === 0) {
    throw new Error("No PIC emails provided");
  }

  const {
    id = "",
    refNo = "",
    titleProjectName = "",
    deadline = "",
    client = "",
    personInCharge = "",
  } = proposal;
  const editUrl = getProposalEditUrl({ ...proposal, id });

  const urgency =
    daysRemaining === 0
      ? "TODAY"
      : daysRemaining <= 2
        ? "CRITICAL"
        : daysRemaining <= 5
          ? "IMPORTANT"
          : "UPCOMING";

  const htmlContent = emailShell({
    title: "Proposal Deadline Reminder",
    introHtml: `Dear ${escapeHtml(personInCharge)},<br><br>This is a reminder that a proposal deadline is approaching. Please review the details below and ensure timely completion.`,
    bodyHtml: `
      <div style="margin-bottom:12px;">${badgeHtml(`${urgency} - ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`, "#d97706")}</div>
      <div style="margin:22px 0 12px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${EMAIL_THEME.headerBg};">Proposal Information</div>
      ${rowsCard([
        rowHtml("Reference No.", `<strong>${escapeHtml(refNo || "—")}</strong>`),
        rowHtml("Title / Project", escapeHtml(titleProjectName || "—")),
        rowHtml("Client", escapeHtml(client || "—")),
        rowHtml("Deadline", `<strong>${escapeHtml(deadline || "—")}</strong>`),
      ])}
    `,
    actionLabel: "Submit & Update",
    actionHref: editUrl,
    noteHtml: "Please ensure this proposal is submitted or completed before the deadline. Access the portal to update status and manage activities.",
    footerText: "If you foresee any challenges in meeting this deadline, please contact the Business Development team immediately.",
    accent: "#d97706",
    accentDark: "#b45309",
  });

  const textContent = `
PROPOSAL DEADLINE REMINDER — ${urgency}

Dear ${personInCharge},

This is a reminder that a proposal deadline is approaching.

Time Until Deadline: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}

PROPOSAL INFORMATION
---
Reference No.: ${refNo || "—"}
Title / Project: ${titleProjectName || "—"}
Client: ${client || "—"}
Deadline: ${deadline || "—"}

Please ensure this proposal is submitted or completed before the deadline. Access the portal to update status:
${editUrl}

If you foresee any challenges in meeting this deadline, please contact the Business Development team immediately.

---
Yours sincerely,
KLSB Portal System

This is an automated notification. Please do not reply to this email.
  `.trim();

  return await sendEmail({
    to: picEmails,
    subject: `${urgency} - ${refNo}`,
    html: htmlContent,
    text: textContent,
  });
}
