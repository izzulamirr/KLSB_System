import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { getEmailNotificationsEnabled, setEmailNotificationsEnabled } from "../../../../lib/notificationPreferences";

async function authorizeUser(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace("Bearer ", "");
  if (!idToken) {
    throw new Error("Unauthorized");
  }

  const admin = await initAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);
  if (!decoded?.uid) {
    throw new Error("Unauthorized");
  }

  return decoded;
}

export async function GET(req) {
  try {
    const decoded = await authorizeUser(req);
    const emailNotificationsEnabled = await getEmailNotificationsEnabled(decoded.uid);
    return NextResponse.json({ emailNotificationsEnabled });
  } catch (err) {
    const message = String(err?.message || err || "Failed to load notification preferences");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PUT(req) {
  try {
    const decoded = await authorizeUser(req);
    const body = await req.json();
    const enabled = Boolean(body?.emailNotificationsEnabled);
    await setEmailNotificationsEnabled(decoded.uid, enabled);
    return NextResponse.json({ ok: true, emailNotificationsEnabled: enabled });
  } catch (err) {
    const message = String(err?.message || err || "Failed to save notification preferences");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
