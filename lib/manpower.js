// lib/manpower.js
import initAdmin from "./firebaseAdmin";

export async function getManpowerData() {
  try {
    const admin = await initAdmin();
    const db = admin.firestore();
    const collectionName = process.env.MANPOWER_COLLECTION_NAME || "manpower";
    const collectionNameNormalized = collectionName.toLowerCase();
    const snap = await db.collection(collectionName).get();
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Convert Firestore Timestamps (and similar structures) into plain serializable values
    // so Server Components can pass them safely to Client Components.
    rows = rows.map((r) => {
      // If this is a 'staff' collection, map fields first
      const mapped = collectionNameNormalized === "staff" ? mapStaffToManpower(r) : r;
      return sanitizeRow(mapped);
    });

    return rows;
  } catch (e) {
    // If admin not configured, fall back to empty array so the page still renders
    // and developers can see that admin isn't set up via console logs.
    console.error("getManpowerData error:", e.message || e);
    return [];
  }
}

function mapStaffToManpower(s) {
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
    Rate: s.rate || s.Rate || null,
    NH: s.nh || s.NH || null,
    OT: s.ot || s.OT || null,
  };
}

function sanitizeRow(obj) {
  // Return a shallow-copied object with Timestamp-like fields converted to ISO strings
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] = sanitizeValue(v);
  }
  return out;
}

function sanitizeValue(v) {
  if (v == null) return null;

  // Firestore Admin Timestamp (has toDate function)
  if (typeof v === "object" && typeof v.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch (e) {
      return null;
    }
  }

  // Firestore client/server serialized timestamp object {_seconds, _nanoseconds}
  if (
    typeof v === "object" &&
    Object.prototype.hasOwnProperty.call(v, "_seconds") &&
    Object.prototype.hasOwnProperty.call(v, "_nanoseconds")
  ) {
    try {
      const ms = Number(v._seconds) * 1000 + Math.floor(Number(v._nanoseconds) / 1e6);
      return new Date(ms).toISOString();
    } catch (e) {
      return null;
    }
  }

  // If it's a plain object, recursively sanitize nested fields
  if (typeof v === "object") {
    const o = {};
    for (const [kk, vv] of Object.entries(v)) {
      o[kk] = sanitizeValue(vv);
    }
    return o;
  }

  // primitives (string, number, boolean)
  return v;
}
