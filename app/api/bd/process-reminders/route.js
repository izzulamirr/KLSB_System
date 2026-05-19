import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { isBdRole, resolveUserRole } from "../../../../lib/roleResolver";
import { processReminders } from "../../../../lib/reminderScheduler";

/**
 * POST /api/bd/process-reminders
 * Process all proposals and send deadline/maturation reminders
 * 
 * This endpoint should be called periodically (e.g., via cron job)
 * Authentication: Requires BD role or admin authorization
 */

async function authorizeBd(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace("Bearer ", "");
  
  // Also accept authorization via secret key for cron jobs
  const secretKey = req.headers.get("x-cron-secret");
  if (secretKey === process.env.CRON_SECRET_KEY && process.env.CRON_SECRET_KEY) {
    return { authorized: true, isScheduled: true };
  }
  
  if (!idToken) throw new Error("No ID token provided");

  const admin = await initAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);
  const role = await resolveUserRole(admin, decoded);
  if (!isBdRole(role)) throw new Error("Forbidden");

  return { admin, authorized: true, isScheduled: false };
}

export async function POST(req) {
  try {
    const authResult = await authorizeBd(req);
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let admin;
    if (authResult.isScheduled) {
      // For scheduled/cron calls, initialize fresh admin
      admin = await initAdmin();
    } else {
      // admin already available from authorization
      admin = authResult.admin;
    }

    // Process reminders
    const summary = await processReminders(admin);

    return NextResponse.json({
      success: true,
      message: "Reminders processed successfully",
      summary: {
        processed: summary.processed,
        maturationReminders: summary.maturationReminders,
        deadlineReminders: summary.deadlineReminders,
        errors: summary.errors,
        totalReminders: summary.maturationReminders + summary.deadlineReminders,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Process reminders error:", error);
    const status =
      error.message === "No ID token provided"
        ? 401
        : error.message === "Unauthorized"
          ? 401
          : error.message === "Forbidden"
            ? 403
            : 500;
    return NextResponse.json(
      { error: error.message || "Failed to process reminders" },
      { status }
    );
  }
}

/**
 * GET /api/bd/process-reminders
 * Health check endpoint to verify the reminders service is running
 */
export async function GET(req) {
  try {
    const secretKey = req.headers.get("x-cron-secret");
    
    // Allow GET with secret key or no auth for basic health check
    if (secretKey !== process.env.CRON_SECRET_KEY && process.env.CRON_SECRET_KEY) {
      return NextResponse.json({
        status: "ok",
        service: "bd-reminder-scheduler",
        message: "Service is running. Use POST with proper authentication to process reminders.",
      });
    }

    return NextResponse.json({
      status: "ok",
      service: "bd-reminder-scheduler",
      message: "Reminder scheduler service is operational",
      lastCheck: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error.message },
      { status: 500 }
    );
  }
}
