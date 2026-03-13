import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";

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

    // List all users (up to 1000)
    const listResult = await admin.auth().listUsers(1000);

    const users = listResult.users.map((u) => ({
      uid: u.uid,
      name: u.displayName || u.email?.split("@")[0] || "Unknown",
      email: u.email || "",
      disabled: u.disabled,
      lastSignInTime: u.metadata?.lastSignInTime || null,
      creationTime: u.metadata?.creationTime || null,
      customClaims: u.customClaims || {},
    }));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
