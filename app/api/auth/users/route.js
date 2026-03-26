import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { resolveUserRole, isSysdevRole } from "../../../../lib/roleResolver";

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
    if (!isSysdevRole(requesterRole)) {
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

// PATCH /api/auth/users
// Body: { uid: string, disabled: boolean }
// Only sysdev can activate/deactivate users.
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
    if (!isSysdevRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const uid = String(body?.uid || "").trim();
    const disabled = Boolean(body?.disabled);

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    if (uid === decoded.uid && disabled) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    await admin.auth().updateUser(uid, { disabled });

    return NextResponse.json({ ok: true, uid, disabled });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
