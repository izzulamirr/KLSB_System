import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { resolveUserRole, isSysdevRole } from "../../../../lib/roleResolver";
import { sendEmail } from "../../../../lib/emailService";
import crypto from "crypto";

const ALLOWED_ROLES = new Set(["bd", "sysdev", "hr", "staff"]);

async function hasStaffAdminAccess(admin, decoded, role) {
  const email = String(decoded?.email || "").toLowerCase();
  const staffAdminEmails = (process.env.STAFF_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (isSysdevRole(role) || staffAdminEmails.includes(email)) return true;

  try {
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    const doc = await admin.firestore().collection(roleCollection).doc(decoded.uid).get();
    if (doc.exists && doc.data()?.isAdmin) return true;
  } catch {
    // ignore and fallback to false
  }

  return false;
}

// GET /api/auth/users — returns all Firebase Auth users with lastSignInTime
// Requires a valid Admin or higher role token
export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const requesterRole = await resolveUserRole(admin, decoded);
    if (!(await hasStaffAdminAccess(admin, decoded, requesterRole))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // List all users (up to 1000)
    const listResult = await admin.auth().listUsers(1000);

    const users = await Promise.all(
      listResult.users.map(async (u) => {
        const role = await resolveUserRole(admin, {
          uid: u.uid,
          email: u.email,
          role: u.customClaims?.role,
        });

        // read role doc to include isAdmin flag if present
        const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
        let roleDocData = {};
        try {
          const roleDoc = await admin.firestore().collection(roleCollection).doc(u.uid).get();
          if (roleDoc.exists) roleDocData = roleDoc.data() || {};
        } catch {}

        return {
          uid: u.uid,
          name: u.displayName || u.email?.split("@")[0] || "Unknown",
          email: u.email || "",
          disabled: u.disabled,
          lastSignInTime: u.metadata?.lastSignInTime || null,
          creationTime: u.metadata?.creationTime || null,
          customClaims: { ...(u.customClaims || {}), role, isAdmin: Boolean(roleDocData.isAdmin) },
        };
      })
    );

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/auth/users — create a new user and assign role
// Body: { email: string, displayName: string, password: string, role: string }
// Only sysdev can create users
export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const requesterRole = await resolveUserRole(admin, decoded);
    if (!(await hasStaffAdminAccess(admin, decoded, requesterRole))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const displayName = String(body?.displayName || "").trim();
    const password = String(body?.password || "").trim();
    const role = String(body?.role || "staff").trim().toLowerCase();
    const isAdmin = Boolean(body?.isAdmin);

    if (!email || !displayName || !password) {
      return NextResponse.json({ error: "email, displayName, and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Role must be one of: BD, System Developers, HR, Staff" }, { status: 400 });
    }

    // Create new user in Firebase Auth (disabled until activation).
    // If the account already exists, reuse it and force it back to inactive.
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        disabled: true,
      });
    } catch (createErr) {
      if (createErr?.code !== "auth/email-already-exists") {
        throw createErr;
      }

      userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, {
        displayName,
        password,
        disabled: true,
      });
      userRecord = await admin.auth().getUser(userRecord.uid);
    }

    // Generate activation token and store role+meta in Firestore
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    const activationToken = crypto.randomBytes(24).toString("hex");
    const activationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await admin.firestore().collection(roleCollection).doc(userRecord.uid).set({
      role,
      isAdmin: isAdmin === true,
      createdBy: decoded.uid,
      createdAt: new Date(),
      activationToken,
      activationExpiresAt: activationExpiresAt,
      email,
    });

    // Send activation email with token link
    let activationLink = null;
    try {
      const portalUrl = process.env.PORTAL_URL || "http://localhost:3000";
      activationLink = `${portalUrl.replace(/\/$/, "")}/activate?token=${activationToken}`;

      const html = `
        <p>Hi ${displayName || email},</p>
        <p>An account was created for you on the KLSB Portal. Click the link below to activate your account and go to your dashboard:</p>
        <p><a href="${activationLink}">Activate my account</a></p>
        <p>If you did not expect this email, please ignore it.</p>
      `;

      await sendEmail({ to: email, subject: "Activate your KLSB Portal account", html, text: `Activate: ${activationLink}` });
    } catch (emailErr) {
      console.error("Failed to send activation email:", emailErr?.message || emailErr);
      if (activationLink) console.log("Activation link (fallback):", activationLink);
      if (emailErr && /SMTP|authentication|ENOTFOUND|ECONNREFUSED/i.test(String(emailErr))) {
        console.warn('SMTP error detected. For Gmail use an App Password (enable 2FA) or a provider like SendGrid.');
      }
    }

    const includeLink = process.env.NODE_ENV !== "production" || process.env.SHOW_ACTIVATION_LINK === "true";

    return NextResponse.json({
      ok: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
        activationSent: true,
        ...(includeLink && activationLink ? { activationLink } : {}),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/auth/users
// Body supports:
// { uid: string, disabled?: boolean, displayName?: string, role?: string, password?: string }
// Only staff admins can update users.
export async function PATCH(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const requesterRole = await resolveUserRole(admin, decoded);
    if (!(await hasStaffAdminAccess(admin, decoded, requesterRole))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const uid = String(body?.uid || "").trim();
    const hasDisabled = Object.prototype.hasOwnProperty.call(body || {}, "disabled");
    const disabled = hasDisabled ? Boolean(body?.disabled) : undefined;
    const displayName = String(body?.displayName || "").trim();
    const password = String(body?.password || "").trim();
    const role = String(body?.role || "").trim().toLowerCase();
    const hasIsAdmin = Object.prototype.hasOwnProperty.call(body || {}, "isAdmin");
    const isAdmin = hasIsAdmin ? Boolean(body?.isAdmin) : undefined;

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    if (uid === decoded.uid && disabled) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const authUpdates = {};

    if (displayName) {
      authUpdates.displayName = displayName;
    }

    if (hasDisabled) {
      authUpdates.disabled = disabled;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      authUpdates.password = password;
    }

    if (Object.keys(authUpdates).length > 0) {
      await admin.auth().updateUser(uid, authUpdates);
    }

    if (role || hasIsAdmin) {
      if (role && !ALLOWED_ROLES.has(role)) {
        return NextResponse.json({ error: "Role must be one of: BD, System Developers, HR, Staff" }, { status: 400 });
      }

      const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
      const updateDoc = { updatedBy: decoded.uid, updatedAt: new Date() };
      if (role) updateDoc.role = role;
      if (hasIsAdmin) updateDoc.isAdmin = Boolean(isAdmin);
      await admin.firestore().collection(roleCollection).doc(uid).set(updateDoc, { merge: true });
    }

    if (Object.keys(authUpdates).length === 0 && !role) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      uid,
      updated: {
        ...(displayName ? { displayName } : {}),
        ...(hasDisabled ? { disabled } : {}),
        ...(password ? { passwordUpdated: true } : {}),
        ...(role ? { role } : {}),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/auth/users
// Body: { uid: string }
// Only staff admins can delete users (cannot delete self)
export async function DELETE(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const requesterRole = await resolveUserRole(admin, decoded);
    if (!(await hasStaffAdminAccess(admin, decoded, requesterRole))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const uid = String(body?.uid || "").trim();
    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    if (uid === decoded.uid) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    // Remove user from Firebase Auth
    await admin.auth().deleteUser(uid);

    // Remove role doc if exists
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    await admin.firestore().collection(roleCollection).doc(uid).delete().catch(() => {});

    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
