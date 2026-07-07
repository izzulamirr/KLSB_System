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

// Human-readable identity for audit fields (createdBy/updatedBy) — falls
// back to the uid only if no email/name claim is present on the token.
function getActorIdentity(decoded) {
  return decoded?.email || decoded?.name || decoded?.uid || "unknown";
}

function getCollectionName() {
  return process.env.MANPOWER_COLLECTION_NAME || "manpower";
}

function applyOptionalFilters(queryRef, params) {
  const po = params.get("po");
  const location = params.get("location");

  if (po) return queryRef.where("PO_SO_No", "==", po);
  if (location) return queryRef.where("LOCATION", "==", location);
  return queryRef;
}

export async function GET(req) {
  try {
    const { db } = await getAdminAndDb();
    const collectionName = getCollectionName();
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

    let params;
    try {
      params = new URL(req.url).searchParams;
    } catch {
      const host = req.headers.get("host") || "localhost";
      params = new URL(req.url, `http://${host}`).searchParams;
    }

    const limitParam = Number(params.get("limit") || 0);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 2000) : 0;
    const summary = params.get("summary") === "1";
    const sortBy = params.get("sortBy");
    const sortDir = String(params.get("sortDir") || "asc").toLowerCase() === "desc" ? "desc" : "asc";

    let queryRef = db.collection(collectionName);
    queryRef = applyOptionalFilters(queryRef, params);
    if (sortBy) {
      queryRef = queryRef.orderBy(sortBy, sortDir);
    }

    if (summary) {
      const snap = await queryRef.get();
      let total = 0;
      let active = 0;
      let pending = 0;
      let closed = 0;

      snap.forEach((d) => {
        total += 1;
        const row = d.data() || {};
        const status = String(row.STATUS_COLOR || row.STATUS || "").toLowerCase();
        if (status.includes("active") || status.includes("ongoing")) active += 1;
        else if (status.includes("pending")) pending += 1;
        else if (status.includes("completed") || status.includes("terminated")) closed += 1;
      });

      return NextResponse.json({ total, active, pending, closed });
    }

    if (limit) queryRef = queryRef.limit(limit);

    const snap = await queryRef.get();
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

    const body = await req.json();
    const collectionName = getCollectionName();

    const actor = getActorIdentity(decoded);

    if (Array.isArray(body?.rows)) {
      const rows = body.rows;
      if (!rows.length) return NextResponse.json({ created: 0, rows: [] }, { status: 201 });

      const colRef = db.collection(collectionName);
      const created = [];
      const nowServer = admin.firestore.FieldValue.serverTimestamp();
      const nowIso = new Date().toISOString();

      for (let i = 0; i < rows.length; i += 400) {
        const chunk = rows.slice(i, i + 400);
        const batch = db.batch();

        chunk.forEach((row) => {
          const cleaned = stripEmpty(row);
          const payload = collectionName === "staff" ? mapManpowerToStaff(cleaned) : cleaned;
          const docRef = colRef.doc();
          created.push({ id: docRef.id, ...payload, createdBy: actor, createdAt: nowIso, updatedBy: actor, updatedAt: nowIso });
          batch.set(docRef, {
            ...payload,
            createdBy: actor,
            createdAt: nowServer,
            updatedBy: actor,
            updatedAt: nowServer,
          });
        });

        await batch.commit();
      }

      return NextResponse.json({ created: created.length, rows: created }, { status: 201 });
    }

    const cleaned = stripEmpty(body);
    const payload = collectionName === "staff" ? mapManpowerToStaff(cleaned) : cleaned;
    const nowIso = new Date().toISOString();
    const doc = await db.collection(collectionName).add({
      ...payload,
      createdBy: actor,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actor,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: doc.id, createdBy: actor, createdAt: nowIso, updatedBy: actor, updatedAt: nowIso }, { status: 201 });
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
    const collectionName = getCollectionName();

    const actor = getActorIdentity(decoded);

    if (Array.isArray(body?.rows)) {
      const rows = body.rows.filter((r) => r && r.id);
      if (!rows.length) return NextResponse.json({ updated: 0, ok: true });

      const nowIso = new Date().toISOString();
      for (let i = 0; i < rows.length; i += 400) {
        const chunk = rows.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach((row) => {
          const { id, ...data } = row;
          const cleaned = stripEmpty(data);
          const payload = collectionName === "staff" ? mapManpowerToStaff(cleaned) : cleaned;
          batch.set(
            db.collection(collectionName).doc(id),
            {
              ...payload,
              updatedBy: actor,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      }

      return NextResponse.json({ ok: true, updated: rows.length, updatedBy: actor, updatedAt: nowIso });
    }

    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const { id, ...data } = body;
    const cleaned = stripEmpty(data);
    const payload = collectionName === "staff" ? mapManpowerToStaff(cleaned) : cleaned;
    const nowIso = new Date().toISOString();
    await db.collection(collectionName).doc(id).set({ ...payload, updatedBy: actor, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, updated: 1, updatedBy: actor, updatedAt: nowIso });
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
    const collectionName = getCollectionName();
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
    STAFF_NAME: s.name || s.fullName || s.STAFF_NAME || "",
    POSITION: s.position || s.role || s.POSITION || "",
    STATUS: s.status || "active",
    LOCATION: s.client || s.LOCATION || "",
    SITE: s.location || s.office || s.SITE || "",
    PO_SO_No: s.poNo || s.PO_SO_No || "",
    START_DATE: s.startDate || s.START_DATE || null,
    END_DATE: s.endDate || s.END_DATE || null,
    EXTENSION_STATUS: s.extension || s.EXTENSION_STATUS || "",
    PAY_TYPE: s.payType || s.PAY_TYPE || null,
    Rate: s.rate || s.Rate || null,
    NH: s.nh || s.NH || null,
    OT: s.ot || s.OT || null,
    KLSB_RATE_NORMAL: s.klsbRateNormal || s.KLSB_RATE_NORMAL || null,
    KLSB_RATE_OT: s.klsbRateOt || s.KLSB_RATE_OT || null,
  };
}

function mapManpowerToStaff(man) {
  // Convert portal manpower shape into a 'staff' doc shape. Adjust as needed.
  return {
    name: man.STAFF_NAME,
    position: man.POSITION,
    status: man.STATUS,
    client: man.LOCATION,
    location: man.SITE,
    poNo: man.PO_SO_No,
    startDate: man.START_DATE,
    endDate: man.END_DATE,
    extension: man.EXTENSION_STATUS,
    payType: man.PAY_TYPE,
    rate: man.Rate,
    nh: man.NH,
    ot: man.OT,
    klsbRateNormal: man.KLSB_RATE_NORMAL,
    klsbRateOt: man.KLSB_RATE_OT,
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