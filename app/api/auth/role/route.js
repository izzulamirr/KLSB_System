import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { resolveUserRole, isSysdevRole, isHrRole } from "../../../../lib/roleResolver";

async function hasManpowerWriteAccess(admin, decoded, role) {
  const email = String(decoded?.email || "").toLowerCase();
  const allowedEmails = [
    ...(process.env.MANPOWER_EDITOR_EMAILS || "").split(","),
    ...(process.env.STAFF_ADMIN_EMAILS || "").split(","),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (isSysdevRole(role) || isHrRole(role) || allowedEmails.includes(email)) return true;

  try {
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    const doc = await admin.firestore().collection(roleCollection).doc(decoded.uid).get();
    if (doc.exists && doc.data()?.isAdmin) return true;
  } catch {}

  return false;
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "No ID token provided" }, { status: 401 });
    }

    const admin = await initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const role = await resolveUserRole(admin, decoded);

    // read role doc to include isAdmin flag
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
    let isAdmin = false;
    try {
      const doc = await admin.firestore().collection(roleCollection).doc(decoded.uid).get();
      if (doc.exists) isAdmin = Boolean(doc.data()?.isAdmin);
    } catch {}

    const canManageManpower = await hasManpowerWriteAccess(admin, decoded, role);

    return NextResponse.json({ role, email: decoded.email || null, uid: decoded.uid, isAdmin, canManageManpower });
  } catch (error) {
    console.error("/api/auth/role failed:", error && error.stack ? error.stack : error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
