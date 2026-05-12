import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { resolveUserRole, isSysdevRole } from "../../../../lib/roleResolver";

const STAFF_ADMIN_EMAILS = ["bd@gmail.com"];
const ALLOWED_ROLES = new Set(["bd", "sysdev", "hr", "staff"]);

function hasStaffAdminAccess(decoded, role) {
  const email = String(decoded?.email || "").toLowerCase();
  return isSysdevRole(role) || STAFF_ADMIN_EMAILS.includes(email);
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
    if (!hasStaffAdminAccess(decoded, requesterRole)) {
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

        return {
          uid: u.uid,
          name: u.displayName || u.email?.split("@")[0] || "Unknown",
          email: u.email || "",
          disabled: u.disabled,
          lastSignInTime: u.metadata?.lastSignInTime || null,
          creationTime: u.metadata?.creationTime || null,
          customClaims: { ...(u.customClaims || {}), role },
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
    if (!hasStaffAdminAccess(decoded, requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const displayName = String(body?.displayName || "").trim();
    const password = String(body?.password || "").trim();
    const role = String(body?.role || "staff").trim().toLowerCase();

    if (!email || !displayName || !password) {
      return NextResponse.json({ error: "email, displayName, and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Role must be one of: BD, System Developers, HR, Staff" }, { status: 400 });
    }

    // Create new user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Set role in Firestore
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    await admin.firestore().collection(roleCollection).doc(userRecord.uid).set({
      role,
      createdBy: decoded.uid,
      createdAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
      },
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }
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
    if (!hasStaffAdminAccess(decoded, requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const uid = String(body?.uid || "").trim();
    const hasDisabled = Object.prototype.hasOwnProperty.call(body || {}, "disabled");
    const disabled = hasDisabled ? Boolean(body?.disabled) : undefined;
    const displayName = String(body?.displayName || "").trim();
    const password = String(body?.password || "").trim();
    const role = String(body?.role || "").trim().toLowerCase();

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

    if (role) {
      if (!ALLOWED_ROLES.has(role)) {
        return NextResponse.json({ error: "Role must be one of: BD, System Developers, HR, Staff" }, { status: 400 });
      }

      const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
      await admin.firestore().collection(roleCollection).doc(uid).set(
        {
          role,
          updatedBy: decoded.uid,
          updatedAt: new Date(),
        },
        { merge: true }
      );
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
    if (!hasStaffAdminAccess(decoded, requesterRole)) {
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
