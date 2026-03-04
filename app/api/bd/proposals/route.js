import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { isBdRole, resolveUserRole } from "../../../../lib/roleResolver";

async function authorizeBd(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace("Bearer ", "");
  if (!idToken) throw new Error("No ID token provided");

  const admin = await initAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);
  const role = await resolveUserRole(admin, decoded);
  if (!isBdRole(role)) throw new Error("Forbidden");

  return { admin, decoded };
}

function getCollectionName() {
  return process.env.BD_PROPOSALS_COLLECTION || "bd_proposals";
}

function normalizePayload(body) {
  const numericFields = ["bidValidity", "valueRM"];
  const ignoredFields = ["maturityDays"];
  const out = {};

  for (const [key, value] of Object.entries(body || {})) {
    if (ignoredFields.includes(key)) continue;
    if (value === "" || value === null || value === undefined) continue;
    if (numericFields.includes(key)) {
      const num = Number(value);
      if (!Number.isNaN(num)) out[key] = num;
      continue;
    }
    out[key] = value;
  }

  if (!out.status) out.status = "PENDING";
  return out;
}

export async function GET(req) {
  try {
    const { admin } = await authorizeBd(req);
    const db = admin.firestore();

    let id = null;
    try {
      const url = new URL(req.url);
      id = url.searchParams.get("id");
    } catch {
      const host = req.headers.get("host") || "localhost";
      const url = new URL(req.url, `http://${host}`);
      id = url.searchParams.get("id");
    }

    if (id) {
      const doc = await db.collection(getCollectionName()).doc(id).get();
      if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    const snapshot = await db.collection(getCollectionName()).orderBy("createdAt", "desc").get();
    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(rows);
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(req) {
  try {
    const { admin, decoded } = await authorizeBd(req);
    const db = admin.firestore();
    const body = await req.json();
    const payload = normalizePayload(body);

    const docRef = await db.collection(getCollectionName()).add({
      ...payload,
      createdBy: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: decoded.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: docRef.id }, { status: 201 });
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function PUT(req) {
  try {
    const { admin, decoded } = await authorizeBd(req);
    const db = admin.firestore();
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const payload = normalizePayload(data);
    await db.collection(getCollectionName()).doc(id).set(
      {
        ...payload,
          maturityDays: admin.firestore.FieldValue.delete(),
        updatedBy: decoded.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(req) {
  try {
    await authorizeBd(req);
    const admin = await initAdmin();
    const db = admin.firestore();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await db.collection(getCollectionName()).doc(body.id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
