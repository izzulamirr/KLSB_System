import { NextResponse } from "next/server";
import { getPicEmails } from "../../../../lib/picEmailMap";
import initAdmin from "../../../../lib/firebaseAdmin";
import { isBdRole, resolveUserRole } from "../../../../lib/roleResolver";
import {
  sendMaturationReminder,
  sendDeadlineReminder,
} from "../../../../lib/emailService";

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
      proposal, // Full proposal object (optional)
    } = body;

    // Validate required fields
    if (!proposalId || !personInCharge || !reminderType || !dueDate) {
      return NextResponse.json(
        { error: "Missing required fields: proposalId, personInCharge, reminderType, dueDate" },
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

    // Prepare proposal data for email
    const proposalData = proposal || {
      refNo: proposalRefNo,
      titleProjectName: proposalTitle,
      personInCharge,
    };

    try {
      // Send appropriate reminder based on type
      if (reminderType === "maturation") {
        await sendMaturationReminder(proposalData, picEmails, daysLeft || 0);
      } else if (reminderType === "deadline") {
        await sendDeadlineReminder(proposalData, picEmails, daysLeft || 0);
      } else {
        throw new Error(`Invalid reminderType: ${reminderType}`);
      }

      // Log to audit trail in Firestore
      const db = admin.firestore();
      await db.collection("email_reminders_log").add({
        proposalId,
        proposalRefNo,
        personInCharge,
        reminderType,
        dueDate,
        daysLeft: daysLeft || 0,
        picEmails,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "sent",
      });

      return NextResponse.json({
        success: true,
        message: `${reminderType} reminder sent to ${picEmails.length} recipient${picEmails.length === 1 ? "" : "s"}`,
        recipients: picEmails,
        reminderType,
        proposalRefNo,
        daysRemaining: daysLeft,
      });
    } catch (emailError) {
      console.error("Failed to send reminder email:", emailError);

      // Log failure
      const db = admin.firestore();
      await db.collection("email_reminders_log").add({
        proposalId,
        proposalRefNo,
        personInCharge,
        reminderType,
        dueDate,
        daysLeft: daysLeft || 0,
        picEmails,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "failed",
        error: emailError.message,
      });

      throw emailError;
    }
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
