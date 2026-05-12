import { NextResponse } from "next/server";
import { getPicEmails } from "../../../lib/picEmailMap";
import initAdmin from "../../../lib/firebaseAdmin";
import { isBdRole, resolveUserRole } from "../../../lib/roleResolver";

/**
 * POST /api/bd/send-reminder
 * Send reminder emails to PICs based on proposal data
 * 
 * Body: {
 *   proposalId: string,
 *   proposalRefNo: string,
 *   proposalTitle: string,
 *   personInCharge: string (comma-separated PICs or single PIC),
 *   reminderType: "submission" | "maturation",
 *   dueDate: string (YYYY-MM-DD),
 *   daysLeft: number
 * }
 */

async function authorizeBd(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace("Bearer ", "");
  if (!idToken) throw new Error("No ID token provided");

  const admin = await initAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);
  const role = await resolveUserRole(admin, decoded);
  if (!isBdRole(role)) throw new Error("Forbidden");

  return { admin, decoded };
}

export async function POST(req) {
  try {
    // Authorize request
    const { admin } = await authorizeBd(req);

    const body = await req.json();
    const {
      proposalId,
      proposalRefNo,
      proposalTitle,
      personInCharge,
      reminderType,
      dueDate,
      daysLeft,
    } = body;

    // Validate required fields
    if (!proposalId || !personInCharge || !reminderType || !dueDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get PIC emails
    const picEmails = getPicEmails(personInCharge);
    if (picEmails.length === 0) {
      return NextResponse.json(
        { error: `No valid PICs found in "${personInCharge}"` },
        { status: 400 }
      );
    }

    // Prepare email content
    const reminderLabel = reminderType === "submission" ? "Submission" : "Maturation";
    const daysText = daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0f3d7a; color: white; padding: 20px; border-radius: 8px; }
    .content { margin: 20px 0; line-height: 1.6; }
    .details { background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .details-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .label { font-weight: bold; color: #0f3d7a; }
    .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>KLSB Portal - Proposal Reminder</h2>
    </div>
    
    <div class="content">
      <p>Hi ${personInCharge},</p>
      
      <p>This is a reminder about an upcoming <strong>${reminderLabel}</strong> date for a proposal under your charge.</p>
      
      <div class="details">
        <div class="details-row">
          <span class="label">Reference No:</span>
          <span>${proposalRefNo || "-"}</span>
        </div>
        <div class="details-row">
          <span class="label">Title/Project:</span>
          <span>${proposalTitle || "-"}</span>
        </div>
        <div class="details-row">
          <span class="label">Reminder Type:</span>
          <span>${reminderLabel}</span>
        </div>
        <div class="details-row">
          <span class="label">Due Date:</span>
          <span>${dueDate}</span>
        </div>
        <div class="details-row">
          <span class="label">Time Remaining:</span>
          <span><strong>${daysText}</strong></span>
        </div>
      </div>
      
      <p>Please take the necessary action to ensure this proposal meets its deadline.</p>
      
      <p>Best regards,<br><strong>KLSB Portal System</strong></p>
    </div>
    
    <div class="footer">
      <p>This is an automated message from the KLSB Portal. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
    // For now, log the reminder that would be sent
    picEmails.forEach((email) => {
      console.log(`[REMINDER EMAIL] To: ${email}`);
      console.log(`Subject: Proposal ${reminderLabel} Reminder - ${proposalRefNo}`);
      console.log(`Body: ${emailBody}`);
    });

    // Log to audit trail in Firestore (optional)
    try {
      const db = admin.firestore();
      // Log one entry per recipient
      for (const email of picEmails) {
        await db.collection("email_reminders_log").add({
          proposalId,
          proposalRefNo,
          personInCharge,
          picEmail: email,
          reminderType,
          dueDate,
          daysLeft,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "sent", // Would be "pending" if queued, "failed" if error
        });
      }
    } catch (logError) {
      console.error("Failed to log reminder:", logError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: `Reminder queued for ${picEmails.length} recipient${picEmails.length === 1 ? "" : "s"}`,
      recipients: picEmails,
      reminderType,
      proposalRefNo,
    });
  } catch (err) {
    console.error("Reminder send error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send reminder" },
      { status: err.message === "Forbidden" ? 403 : 500 }
    );
  }
}

/**
 * GET /api/bd/send-reminder
 * Get reminder email log for a specific proposal or all reminders
 * Query params:
 *   - proposalId (optional): Get reminders for specific proposal
 *   - limit (optional): Number of records to fetch (default 50)
 */
export async function GET(req) {
  try {
    const { admin } = await authorizeBd(req);

    const db = admin.firestore();
    const url = new URL(req.url);
    const proposalId = url.searchParams.get("proposalId");
    const limitParam = url.searchParams.get("limit") || "50";
    const limit = Math.min(Math.max(1, parseInt(limitParam)), 500); // Between 1-500

    let query = db.collection("email_reminders_log").orderBy("sentAt", "desc");

    if (proposalId) {
      query = query.where("proposalId", "==", proposalId);
    }

    const snapshot = await query.limit(limit).get();
    const reminders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      count: reminders.length,
      reminders,
    });
  } catch (err) {
    console.error("Get reminders error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to get reminders" },
      { status: err.message === "Forbidden" ? 403 : 500 }
    );
  }
}
