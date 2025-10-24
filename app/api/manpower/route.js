import { NextResponse } from "next/server";
import initAdmin from "../../../lib/firebaseAdmin";

async function getAdminAndDb() {
  const admin = await initAdmin();
  const db = admin.firestore();
  return { admin, db };
}

async function verifyToken(req, admin) {
  const auth = req.headers.get("authorization") || "";
  const idToken = auth.replace("Bearer ", "");
  if (!idToken) throw new Error("No ID token provided");
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded;
}

export async function GET(req) {
  try {
    const { db } = await getAdminAndDb();
    const collectionName = process.env.MANPOWER_COLLECTION_NAME || "manpower";
    const collectionNameNormalized = collectionName.toLowerCase();

    // Support optional ?id=docId to fetch a single document
    // req.url may sometimes be a relative URL depending on environment; be defensive.
    let id = null;
    try {
      const url = new URL(req.url);
      id = url.searchParams.get("id");
    } catch (err) {
      try {
        const host = req.headers.get("host") || "localhost";
        const url = new URL(req.url, `http://${host}`);
        id = url.searchParams.get("id");
      } catch (err2) {
        // give up — leave id null
        id = null;
      }
    }
    if (id) {
      const docSnap = await db.collection(collectionName).doc(id).get();
      if (!docSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
      let row = { id: docSnap.id, ...docSnap.data() };
      if (collectionNameNormalized === "staff") row = mapStaffToManpower(row);
      return NextResponse.json(row);
    }

    const snap = await db.collection(collectionName).get();
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // If the project uses a 'staff' collection with a different shape, map it into the
    // portal's expected manpower shape. You can extend this mapping as needed.
    if (collectionNameNormalized === "staff") {
      rows = rows.map((r) => mapStaffToManpower(r));
    }
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { admin, db } = await getAdminAndDb();
    const decoded = await verifyToken(req, admin);
    // basic auth check, allow any authenticated user for now
    const body = await req.json();
    const cleaned = stripEmpty(body);
    const collectionName = process.env.MANPOWER_COLLECTION_NAME || "manpower";
    const payload = collectionName === "staff" ? mapManpowerToStaff(cleaned) : cleaned;
    const doc = await db.collection(collectionName).add({ ...payload, createdBy: decoded.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (e) {
    // 401 for auth issues, 500 for other errors
    const status = e.message && e.message.includes("No ID token") ? 401 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function PUT(req) {
  try {
    const { admin, db } = await getAdminAndDb();
    const decoded = await verifyToken(req, admin);
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { id, ...data } = body;
    const cleaned = stripEmpty(data);
    const collectionName = process.env.MANPOWER_COLLECTION_NAME || "manpower";
    const payload = collectionName === "staff" ? mapManpowerToStaff(cleaned) : cleaned;
    await db.collection(collectionName).doc(id).set({ ...payload, updatedBy: decoded.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e.message && e.message.includes("No ID token") ? 401 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(req) {
  try {
    const { admin, db } = await getAdminAndDb();
    const decoded = await verifyToken(req, admin);
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const collectionName = process.env.MANPOWER_COLLECTION_NAME || "manpower";
    await db.collection(collectionName).doc(body.id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e.message && e.message.includes("No ID token") ? 401 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

// --- Mapping helpers -----------------------------------------------------
function mapStaffToManpower(doc) {
  // doc is { id, ...staffFields }
  // This mapping is best-effort. Adjust field names as your 'staff' documents actually use.
  const s = doc;
  return {
    id: s.id,
    BIL: s.BIL || s.bil || null,
    STAFF_NAME: s.name || s.fullName || s.STAFF_NAME || "",
    POSITION: s.position || s.role || s.POSITION || "",
    STATUS: s.status || "active",
    LOCATION: s.location || s.office || s.LOCATION || "",
    PO_SO_No: s.poNo || s.PO_SO_No || "",
    START_DATE: s.startDate || s.START_DATE || null,
    END_DATE: s.endDate || s.END_DATE || null,
    EXTENSION_STATUS: s.extension || s.EXTENSION_STATUS || "",
    PAY_TYPE: s.payType || s.PAY_TYPE || null,
    Rate: s.rate || s.Rate || null,
    NH: s.nh || s.NH || null,
    OT: s.ot || s.OT || null,
  };
}

function mapManpowerToStaff(man) {
  // Convert portal manpower shape into a 'staff' doc shape. Adjust as needed.
  return {
    BIL: man.BIL,
    name: man.STAFF_NAME,
    position: man.POSITION,
    status: man.STATUS,
    location: man.LOCATION,
    poNo: man.PO_SO_No,
    startDate: man.START_DATE,
    endDate: man.END_DATE,
    extension: man.EXTENSION_STATUS,
    payType: man.PAY_TYPE,
    rate: man.Rate,
    nh: man.NH,
    ot: man.OT,
  };
}

// Remove empty string, null, and undefined properties recursively (one level is enough here)
function stripEmpty(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}