import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";

// GET /api/auth/activate?token=...
export async function GET(req) {
  const token = String(req.nextUrl.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    const admin = await initAdmin();
    const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";

    // Find a doc with matching activationToken
    const snapshot = await admin.firestore().collection(roleCollection).where("activationToken", "==", token).limit(1).get();
    if (snapshot.empty) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

    const doc = snapshot.docs[0];
    const data = doc.data() || {};
    if (data.activationExpiresAt && data.activationExpiresAt.toDate && data.activationExpiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    const uid = doc.id;
    // Enable user
    await admin.auth().updateUser(uid, { disabled: false });

    // Clear activation token and set role on claims
    await admin.firestore().collection(roleCollection).doc(uid).set({ activationToken: null, activationExpiresAt: null }, { merge: true });

    const role = String(data.role || "staff").toLowerCase();
    // Set custom claims so frontend can redirect appropriately
    await admin.auth().setCustomUserClaims(uid, { role });

    // Redirect user to appropriate dashboard path
    const portalUrl = process.env.PORTAL_URL || "http://localhost:3000";
    const redirectPath = role === "bd" ? "/bd" : role === "hr" ? "/dashboard/manpower" : "/portal";
    return NextResponse.redirect(`${portalUrl.replace(/\/$/, "")}${redirectPath}`);
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
