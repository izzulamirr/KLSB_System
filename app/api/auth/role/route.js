import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { resolveUserRole } from "../../../../lib/roleResolver";

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

    return NextResponse.json({ role, email: decoded.email || null, uid: decoded.uid, isAdmin });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
