/**
 * Email Service for sending notifications and reminders
 * Uses SMTP via nodemailer for reliable email delivery
 */

import "dotenv/config";
import nodemailer from "nodemailer";

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

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; background: #f5f5f5; line-height: 1.6; }
    .outer { background: #f5f5f5; padding: 20px 0; }
    .container { max-width: 580px; margin: 0 auto; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: #1a3a52; color: white; padding: 40px 30px; text-align: center; border-bottom: 3px solid #2c5aa0; }
    .header h1 { font-size: 24px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 5px; }
    .header p { font-size: 13px; opacity: 0.9; }
    .content { padding: 30px; }
    .greeting { font-size: 15px; color: #2c3e50; margin-bottom: 20px; }
    .intro { font-size: 14px; color: #555; margin-bottom: 25px; line-height: 1.7; }
    .section-label { font-size: 11px; font-weight: 700; color: #1a3a52; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 25px; margin-bottom: 12px; }
    .proposal-box { background: #f9fafb; border: 1px solid #e8eef6; border-radius: 4px; padding: 20px; }
    .proposal-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e8eef6; }
    .proposal-row:last-child { border-bottom: none; }
    .proposal-label { font-size: 13px; font-weight: 600; color: #1a3a52; flex: 0 0 35%; }
    .proposal-value { font-size: 13px; color: #2c3e50; text-align: right; flex: 1; }
    .proposal-value strong { color: #1a3a52; font-weight: 600; }
    .cta-section { margin-top: 30px; padding: 20px; background: #f0f4f8; border-left: 4px solid #2c5aa0; border-radius: 2px; }
    .cta-text { font-size: 14px; color: #2c3e50; margin-bottom: 15px; }
    .cta-button { display: inline-block; background: #2c5aa0; color: white; padding: 12px 28px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px; }
    .cta-button:hover { background: #1a3a52; }
    .footer-text { font-size: 13px; color: #555; margin-top: 25px; }
    .closing { font-size: 13px; color: #2c3e50; margin-top: 20px; }
    .divider { border-top: 1px solid #e8eef6; margin: 25px 0; }
    .footer { background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e8eef6; text-align: center; }
    .footer-content { font-size: 12px; color: #999; }
    .footer-content a { color: #2c5aa0; text-decoration: none; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <h1>New Proposal Notification</h1>
        <p>KLSB Portal System</p>
      </div>
      
      <div class="content">
        <div class="greeting">Dear ${personInCharge},</div>
        
        <div class="intro">
          A new proposal has been created and assigned to you. Please review the proposal details and take appropriate action in the portal.
        </div>
        
        <div class="section-label">Proposal Information</div>
        <div class="proposal-box">
          <div class="proposal-row">
            <span class="proposal-label">Reference No.</span>
            <span class="proposal-value"><strong>${refNo || "—"}</strong></span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Title / Project</span>
            <span class="proposal-value">${titleProjectName || "—"}</span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Client</span>
            <span class="proposal-value">${client || "—"}</span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Value (RM)</span>
            <span class="proposal-value">${
              valueRM
                ? new Intl.NumberFormat("en-MY", {
                    style: "currency",
                    currency: "MYR",
                  }).format(valueRM)
                : "—"
            }</span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Deadline</span>
            <span class="proposal-value"><strong>${deadline || "—"}</strong></span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Maturity Date</span>
            <span class="proposal-value"><strong>${maturityOnDate || "—"}</strong></span>
          </div>
        </div>
        
        <div class="cta-section">
          <div class="cta-text">Access the portal to view complete details, update status, and manage proposal activities.</div>
          <a href="${process.env.PORTAL_URL || "https://portal.kemuncaklanai.com"}/bd/proposals" class="cta-button">View Proposal</a>
        </div>
        
        <div class="divider"></div>
        
        <div class="footer-text">
          If you require further information or assistance regarding this proposal, please contact the Business Development team.
        </div>
        
        <div class="closing">
          Yours sincerely,<br>
          <strong>KLSB Portal System</strong>
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-content">
          This is an automated notification from the KLSB Portal. Please do not reply to this email.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
NEW PROPOSAL NOTIFICATION

Dear ${personInCharge},

A new proposal has been created and assigned to you. Please review the proposal details and take appropriate action in the portal.

PROPOSAL INFORMATION
---
Reference No.: ${refNo || "—"}
Title / Project: ${titleProjectName || "—"}
Client: ${client || "—"}
Value (RM): ${
    valueRM
      ? new Intl.NumberFormat("en-MY", {
          style: "currency",
          currency: "MYR",
        }).format(valueRM)
      : "—"
  }
Deadline: ${deadline || "—"}
Maturity Date: ${maturityOnDate || "—"}

Access the portal to view complete details and manage proposal activities:
${process.env.PORTAL_URL || "https://portal.kemuncaklanai.com"}/bd/proposals

---
If you require further information regarding this proposal, please contact the Business Development team.

Yours sincerely,
KLSB Portal System

This is an automated notification. Please do not reply to this email.
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
    refNo = "",
    titleProjectName = "",
    maturityOnDate = "",
    personInCharge = "",
  } = proposal;

  const urgency =
    daysRemaining === 0
      ? "TODAY"
      : daysRemaining <= 3
        ? "URGENT"
        : daysRemaining <= 7
          ? "UPCOMING"
          : "REMINDER";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; background: #f5f5f5; line-height: 1.6; }
    .outer { background: #f5f5f5; padding: 20px 0; }
    .container { max-width: 580px; margin: 0 auto; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: #1a3a52; color: white; padding: 40px 30px; text-align: center; border-bottom: 3px solid #c2410c; }
    .header h1 { font-size: 24px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 5px; }
    .header p { font-size: 13px; opacity: 0.9; }
    .content { padding: 30px; }
    .greeting { font-size: 15px; color: #2c3e50; margin-bottom: 20px; }
    .intro { font-size: 14px; color: #555; margin-bottom: 25px; line-height: 1.7; }
    .urgency-tag { display: inline-block; background: #c2410c; color: white; padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 3px; margin-bottom: 20px; }
    .countdown-box { background: #f0f4f8; padding: 25px; text-align: center; border-left: 4px solid #c2410c; margin-bottom: 20px; }
    .countdown-days { font-size: 48px; font-weight: 700; color: #c2410c; line-height: 1; }
    .countdown-label { font-size: 13px; color: #555; margin-top: 8px; }
    .section-label { font-size: 11px; font-weight: 700; color: #1a3a52; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 20px; margin-bottom: 12px; }
    .proposal-box { background: #f9fafb; border: 1px solid #e8eef6; border-radius: 4px; padding: 20px; }
    .proposal-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e8eef6; }
    .proposal-row:last-child { border-bottom: none; }
    .proposal-label { font-size: 13px; font-weight: 600; color: #1a3a52; flex: 0 0 35%; }
    .proposal-value { font-size: 13px; color: #2c3e50; text-align: right; flex: 1; }
    .proposal-value strong { color: #1a3a52; font-weight: 600; }
    .action-section { margin-top: 20px; padding: 20px; background: #f0f4f8; border-left: 4px solid #c2410c; border-radius: 2px; }
    .action-text { font-size: 14px; color: #2c3e50; margin-bottom: 15px; }
    .action-button { display: inline-block; background: #c2410c; color: white; padding: 12px 28px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px; }
    .action-button:hover { background: #a03008; }
    .footer-text { font-size: 13px; color: #555; margin-top: 25px; }
    .closing { font-size: 13px; color: #2c3e50; margin-top: 20px; }
    .divider { border-top: 1px solid #e8eef6; margin: 25px 0; }
    .footer { background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e8eef6; text-align: center; }
    .footer-content { font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <h1>Proposal Maturation Reminder</h1>
        <p>KLSB Portal System</p>
      </div>
      
      <div class="content">
        <div class="greeting">Dear ${personInCharge},</div>
        
        <div class="intro">
          This is a reminder that a proposal under your charge is approaching its maturation date. Please review the details below and ensure all required actions are completed.
        </div>
        
        <div class="urgency-tag">${urgency} — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining</div>
        
        <div class="section-label">Proposal Information</div>
        <div class="proposal-box">
          <div class="proposal-row">
            <span class="proposal-label">Reference No.</span>
            <span class="proposal-value"><strong>${refNo || "—"}</strong></span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Title / Project</span>
            <span class="proposal-value">${titleProjectName || "—"}</span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Maturity Date</span>
            <span class="proposal-value"><strong>${maturityOnDate || "—"}</strong></span>
          </div>
        </div>
        
        <div class="action-section">
          <div class="action-text">Access the portal to review the proposal status and ensure all required follow-ups and actions are completed before the maturation date.</div>
          <a href="${process.env.PORTAL_URL || "https://portal.kemuncaklanai.com"}/bd/proposals" class="action-button">Update Status</a>
        </div>
        
        <div class="divider"></div>
        
        <div class="footer-text">
          For further assistance regarding this proposal, please contact the Business Development team.
        </div>
        
        <div class="closing">
          Yours sincerely,<br>
          <strong>KLSB Portal System</strong>
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-content">
          This is an automated notification. Please do not reply to this email.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

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
${process.env.PORTAL_URL || "https://portal.kemuncaklanai.com"}/bd/proposals

---
For further assistance, please contact the Business Development team.

Yours sincerely,
KLSB Portal System

This is an automated notification. Please do not reply to this email.
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
    refNo = "",
    titleProjectName = "",
    deadline = "",
    client = "",
    personInCharge = "",
  } = proposal;

  const urgency =
    daysRemaining === 0
      ? "TODAY"
      : daysRemaining <= 2
        ? "CRITICAL"
        : daysRemaining <= 5
          ? "IMPORTANT"
          : "UPCOMING";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; background: #f5f5f5; line-height: 1.6; }
    .outer { background: #f5f5f5; padding: 20px 0; }
    .container { max-width: 580px; margin: 0 auto; background: white; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: #1a3a52; color: white; padding: 40px 30px; text-align: center; border-bottom: 3px solid #d97706; }
    .header h1 { font-size: 24px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 5px; }
    .header p { font-size: 13px; opacity: 0.9; }
    .content { padding: 30px; }
    .greeting { font-size: 15px; color: #2c3e50; margin-bottom: 20px; }
    .intro { font-size: 14px; color: #555; margin-bottom: 25px; line-height: 1.7; }
    .urgency-tag { display: inline-block; background: #d97706; color: white; padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 3px; margin-bottom: 20px; }
    .countdown-box { background: #fef3c7; padding: 25px; text-align: center; border-left: 4px solid #d97706; margin-bottom: 20px; }
    .countdown-days { font-size: 48px; font-weight: 700; color: #d97706; line-height: 1; }
    .countdown-label { font-size: 13px; color: #555; margin-top: 8px; }
    .section-label { font-size: 11px; font-weight: 700; color: #1a3a52; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 20px; margin-bottom: 12px; }
    .proposal-box { background: #f9fafb; border: 1px solid #e8eef6; border-radius: 4px; padding: 20px; }
    .proposal-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e8eef6; }
    .proposal-row:last-child { border-bottom: none; }
    .proposal-label { font-size: 13px; font-weight: 600; color: #1a3a52; flex: 0 0 35%; }
    .proposal-value { font-size: 13px; color: #2c3e50; text-align: right; flex: 1; }
    .proposal-value strong { color: #1a3a52; font-weight: 600; }
    .action-section { margin-top: 20px; padding: 20px; background: #fef3c7; border-left: 4px solid #d97706; border-radius: 2px; }
    .action-text { font-size: 14px; color: #2c3e50; margin-bottom: 15px; }
    .action-button { display: inline-block; background: #d97706; color: white; padding: 12px 28px; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px; }
    .action-button:hover { background: #b45309; }
    .footer-text { font-size: 13px; color: #555; margin-top: 25px; }
    .closing { font-size: 13px; color: #2c3e50; margin-top: 20px; }
    .divider { border-top: 1px solid #e8eef6; margin: 25px 0; }
    .footer { background: #f9fafb; padding: 20px 30px; border-top: 1px solid #e8eef6; text-align: center; }
    .footer-content { font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <h1>Proposal Deadline Reminder</h1>
        <p>KLSB Portal System</p>
      </div>
      
      <div class="content">
        <div class="greeting">Dear ${personInCharge},</div>
        
        <div class="intro">
          This is a reminder that a proposal deadline is approaching. Please review the details below and ensure timely completion.
        </div>
        
        <div class="urgency-tag">${urgency} — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining</div>
        
        <div class="section-label">Proposal Information</div>
        <div class="proposal-box">
          <div class="proposal-row">
            <span class="proposal-label">Reference No.</span>
            <span class="proposal-value"><strong>${refNo || "—"}</strong></span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Title / Project</span>
            <span class="proposal-value">${titleProjectName || "—"}</span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Client</span>
            <span class="proposal-value">${client || "—"}</span>
          </div>
          <div class="proposal-row">
            <span class="proposal-label">Deadline</span>
            <span class="proposal-value"><strong>${deadline || "—"}</strong></span>
          </div>
        </div>
        
        <div class="action-section">
          <div class="action-text">Please ensure this proposal is submitted or completed before the deadline. Access the portal to update status and manage activities.</div>
          <a href="${process.env.PORTAL_URL || "https://portal.kemuncaklanai.com"}/bd/proposals" class="action-button">Submit & Update</a>
        </div>
        
        <div class="divider"></div>
        
        <div class="footer-text">
          If you foresee any challenges in meeting this deadline, please contact the Business Development team immediately.
        </div>
        
        <div class="closing">
          Yours sincerely,<br>
          <strong>KLSB Portal System</strong>
        </div>
      </div>
      
      <div class="footer">
        <div class="footer-content">
          This is an automated notification. Please do not reply to this email.
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

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
${process.env.PORTAL_URL || "https://portal.kemuncaklanai.com"}/bd/proposals

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
