import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { resolveUserRole, isSysdevRole } from "../../../../lib/roleResolver";
import { sendEmail } from "../../../../lib/emailService";
import crypto from "crypto";

async function hasStaffAdminAccess(admin, decoded, role) {
  const email = String(decoded?.email || "").toLowerCase();
  const STAFF_ADMIN_EMAILS = (process.env.STAFF_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (isSysdevRole(role) || STAFF_ADMIN_EMAILS.includes(email)) return true;

  try {
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    const doc = await admin.firestore().collection(roleCollection).doc(decoded.uid).get();
    if (doc.exists && doc.data()?.isAdmin) return true;
  } catch {
    // ignore and fallback to false
  }

  return false;
}

// POST /api/auth/resend-activation
// Body: { email: string }
export async function POST(req) {
  try {
    const allowDevBypass = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH_BYPASS === "true";

    let admin = null;
    let decoded = null;
    let requesterRole = null;

    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");

    if (!idToken) {
      if (!allowDevBypass) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      // Initialize admin for dev bypass so we can operate on users locally
      admin = await initAdmin();
    } else {
      admin = await initAdmin();
      decoded = await admin.auth().verifyIdToken(idToken);
      if (!decoded?.uid) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

      requesterRole = await resolveUserRole(admin, decoded);
      if (!(await hasStaffAdminAccess(admin, decoded, requesterRole))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    // Find user by email in Auth first, then fall back to the staff role document.
    let userRecord = null;
    let uid = null;
    let userDisplayName = email;
    let userRole = "staff";

    try {
      userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
      userDisplayName = userRecord.displayName || email;
    } catch {
      const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
      const roleSnapshot = await admin.firestore()
        .collection(roleCollection)
        .where("email", "==", email)
        .limit(1)
        .get();

      if (roleSnapshot.empty) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const roleDoc = roleSnapshot.docs[0];
      uid = roleDoc.id;
      const roleData = roleDoc.data() || {};
      userDisplayName = roleData.displayName || email;
      userRole = String(roleData.role || "staff").toLowerCase();
    }

    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";

    // Generate activation token
    const activationToken = crypto.randomBytes(24).toString("hex");
    const activationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await admin.firestore().collection(roleCollection).doc(uid).set({
      activationToken,
      activationExpiresAt,
      email,
      role: userRole,
    }, { merge: true });

    // Ensure user is disabled until activation
    await admin.auth().updateUser(uid, { disabled: true }).catch(() => {});

    const portalUrl = process.env.PORTAL_URL || "http://localhost:3000";
    const activationLink = `${portalUrl.replace(/\/$/, "")}/activate?token=${activationToken}`;

    // Try to send email
    let emailSent = false;
    let emailError = null;
    try {
      const html = `
        <p>Hi ${userDisplayName},</p>
        <p>Please click the link below to activate your KLSB Portal account:</p>
        <p><a href="${activationLink}">Activate my account</a></p>
      `;
      await sendEmail({ to: email, subject: "Activate your KLSB Portal account", html, text: `Activate: ${activationLink}` });
      emailSent = true;
    } catch (emailErr) {
      emailError = String(emailErr?.message || emailErr || "Unknown SMTP error");
      console.error("Resend activation email failed:", emailError);
      console.log("Activation link (fallback):", activationLink);
    }

    const includeLink = process.env.NODE_ENV !== "production" || process.env.SHOW_ACTIVATION_LINK === "true";
    const includeDetails = process.env.NODE_ENV !== "production";
    return NextResponse.json({ ok: true, email, ...(includeLink ? { activationLink } : {}), ...(includeDetails ? { emailSent, emailError } : {}) });
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
