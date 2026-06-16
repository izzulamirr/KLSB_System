import { NextResponse } from "next/server";
import crypto from "crypto";
import initAdmin from "../../../../lib/firebaseAdmin";
import { sendEmail } from "../../../../lib/emailService";

const DEFAULT_COLLECTION = "password_change_verifications";
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function getCollectionName() {
  return process.env.PASSWORD_VERIFICATION_COLLECTION || DEFAULT_COLLECTION;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function portalLink(path) {
  const portalUrl = (process.env.PORTAL_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${portalUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function verificationEmailHtml(email, code) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#2f3238;font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#2d3748;">
  <div style="padding:24px 0;background:#2f3238;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d7dde8;">
      <div style="background:#3f5f7f;color:#fff;text-align:center;padding:34px 28px;border-bottom:4px solid #35506a;">
        <div style="font-size:24px;line-height:1.2;font-weight:700;">Security Verification</div>
        <div style="margin-top:8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;opacity:.9;">KLSB Portal System</div>
      </div>
      <div style="padding:28px;background:#ffffff;">
        <div style="font-size:14px;line-height:1.7;color:#5b6678;margin-bottom:22px;">Hi ${escapeHtml(email)},<br><br>Your one-time verification code is below. Use it to confirm your password change.</div>
        <div style="background:#f3f5f9;border:1px solid #cfd7e4;padding:18px;text-align:center;">
          <div style="font-size:28px;line-height:1;font-weight:800;letter-spacing:8px;color:#3f5f7f;">${escapeHtml(code)}</div>
          <div style="margin-top:10px;font-size:12px;color:#5b6678;">Expires in ${CODE_TTL_MINUTES} minutes</div>
        </div>
        <div style="margin-top:18px;padding:18px;background:#f3f5f9;border-left:4px solid #2f66b1;font-size:14px;line-height:1.7;color:#5b6678;">
          Open the portal to continue your password update.
          <div style="margin-top:14px;">
            <a href="${portalLink("/login")}" style="display:inline-block;background:#2f66b1;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 20px;border-radius:2px;">Open Portal</a>
          </div>
        </div>
        <div style="margin-top:22px;font-size:13px;line-height:1.7;color:#5b6678;">If you did not request this code, you can ignore this email.</div>
        <div style="margin-top:18px;font-size:13px;line-height:1.6;color:#2d3748;"><strong>KLSB Portal System</strong></div>
      </div>
      <div style="background:#e9edf3;text-align:center;padding:16px 22px;font-size:11px;line-height:1.5;color:#778190;border-top:1px solid #d7dde8;">This is an automated email from the KLSB Portal. Please do not reply to this email.</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

async function authorizeUser(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace("Bearer ", "");
  if (!idToken) {
    throw new Error("Unauthorized");
  }

  const admin = await initAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);
  if (!decoded?.uid || !decoded?.email) {
    throw new Error("Unauthorized");
  }

  return { admin, decoded };
}

async function sendVerificationCode(admin, decoded) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  const collection = admin.firestore().collection(getCollectionName());

  await collection.doc(decoded.uid).set(
    {
      uid: decoded.uid,
      email: String(decoded.email || "").toLowerCase(),
      codeHash: hashCode(code),
      attempts: 0,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    },
    { merge: true }
  );

  const html = verificationEmailHtml(decoded.email, code);

  await sendEmail({
    to: decoded.email,
    subject: "Your KLSB Portal verification code",
    html,
    text: `Your KLSB Portal verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
  });

  return NextResponse.json({ ok: true, message: "Verification code sent", expiresInMinutes: CODE_TTL_MINUTES, portalUrl: portalLink("/login") });
}

async function verifyCode(admin, decoded, code) {
  const collection = admin.firestore().collection(getCollectionName());
  const docRef = collection.doc(decoded.uid);
  const snap = await docRef.get();

  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "No verification code found. Send a new code first." }, { status: 400 });
  }

  const data = snap.data() || {};
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt || 0);
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || Date.now() > expiresAt.getTime()) {
    await docRef.delete().catch(() => {});
    return NextResponse.json({ ok: false, error: "Verification code expired. Send a new code." }, { status: 400 });
  }

  const nextAttempts = Number(data.attempts || 0) + 1;
  if (nextAttempts > MAX_ATTEMPTS) {
    await docRef.delete().catch(() => {});
    return NextResponse.json({ ok: false, error: "Too many invalid attempts. Send a new code." }, { status: 429 });
  }

  const normalizedCode = String(code || "").trim();
  if (!normalizedCode || hashCode(normalizedCode) !== String(data.codeHash || "")) {
    await docRef.set({ attempts: nextAttempts }, { merge: true });
    return NextResponse.json({ ok: false, error: "Invalid verification code." }, { status: 400 });
  }

  await docRef.delete().catch(() => {});
  return NextResponse.json({ ok: true, message: "Verification code accepted" });
}

export async function POST(req) {
  try {
    const { admin, decoded } = await authorizeUser(req);
    const body = await req.json();
    const action = String(body?.action || "").toLowerCase();

    if (action === "send") {
      return await sendVerificationCode(admin, decoded);
    }

    if (action === "verify") {
      return await verifyCode(admin, decoded, body?.code);
    }

    return NextResponse.json({ error: "Invalid action. Use send or verify." }, { status: 400 });
  } catch (err) {
    const message = String(err?.message || err || "Failed to process verification code");
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}