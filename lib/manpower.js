// lib/manpower.js
// Provides helpers to import manpower data from a CSV file and persist to
// Firestore (via firebase-admin). Also exposes a reader to fetch stored
// manpower documents.

import fs from "fs";
import path from "path";
import os from "os";
import initAdmin from "./firebaseAdmin.js";

// Public: read manpower records from Firestore collection `manpower`
export async function getManpowerData({ limit = 1000, poSoNo = null, location = null } = {}) {
  const admin = await initAdmin();
  const db = admin.firestore();
  let q = db.collection("manpower");

  if (poSoNo) {
    q = q.where("PO_SO_No", "==", String(poSoNo));
  } else if (location) {
    q = q.where("LOCATION", "==", String(location));
  }

  if (limit) q = q.limit(limit);
  const snap = await q.get();
  const rows = [];
  snap.forEach((doc) => {
    const data = doc.data();
    // Recursively convert Firestore Timestamp objects to ISO strings
    function sanitize(val) {
      if (val && typeof val === "object") {
        // Firestore Timestamp
        if (val._seconds != null && val._nanoseconds != null) {
          const d = new Date(val._seconds * 1000 + Math.floor(val._nanoseconds / 1e6));
          return d.toISOString();
        }
        // Array
        if (Array.isArray(val)) return val.map(sanitize);
        // Object
        const out = {};
        for (const k in val) out[k] = sanitize(val[k]);
        return out;
      }
      return val;
    }
    rows.push({ id: doc.id, ...sanitize(data) });
  });
  return rows;
}

// Public: importCsvToFirestore(filePath, options)
// - filePath: path to the CSV file (absolute or relative to process.cwd())
// - options:
//    { collection = 'manpower', headerRow = 6, startRow = 7, endRow = 223, batchSize = 500 }
// Returns: { imported: number, failed: number, errors: Array }
export async function importCsvToFirestore(filePath, options = {}) {
  const opts = {
    collection: "manpower",
    headerRow: 6,
    startRow: 7,
    endRow: 223,
    batchSize: 500,
    ...options,
  };

  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`CSV file not found: ${abs}`);

  const raw = fs.readFileSync(abs, "utf8");
  const rows = parseCsv(raw);

  // Rows is array of arrays. CSV rows are 1-indexed so headerRow refers to that.
  // Try the configured header row first; if it doesn't look like a header,
  // attempt to detect the header row automatically within the first 12 rows.
  let headerIdx = opts.headerRow - 1; // convert to 0-index
  if (headerIdx < 0 || headerIdx >= rows.length) headerIdx = -1;
  if (headerIdx === -1 || !looksLikeHeader(rows[headerIdx])) {
    const detected = detectHeader(rows, 0, Math.min(rows.length - 1, 12));
    if (detected >= 0) headerIdx = detected;
  }
  if (headerIdx < 0 || headerIdx >= rows.length) throw new Error("headerRow out of bounds");

  const header = rows[headerIdx].map((h) => (h == null ? "" : String(h).trim()));

  const startIdx = Math.max(0, opts.startRow - 1);
  const endIdx = Math.min(rows.length - 1, opts.endRow - 1);
  if (startIdx > endIdx) throw new Error("Invalid startRow/endRow range");

  const dataRows = rows.slice(startIdx, endIdx + 1);

  // Map and sanitize each row to an object matching our Firestore schema
  const docs = dataRows.map((r) => mapCsvRowToManpower(header, r));

  // Initialize admin & Firestore
  const admin = await initAdmin();
  const db = admin.firestore();
  const colRef = db.collection(opts.collection);

  // Batch write in chunks
  let imported = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < docs.length; i += opts.batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + opts.batchSize);
    for (const doc of chunk) {
      const docRef = colRef.doc();
      batch.set(docRef, doc, { merge: true });
    }
    try {
      await batch.commit();
      imported += chunk.length;
    } catch (e) {
      failed += chunk.length;
      errors.push({ chunkStart: i, error: e?.message || String(e) });
    }
  }

  return { imported, failed, errors };
}

// parseCsv: very small CSV parser that handles quoted fields and newlines.
// Returns array of rows where each row is an array of values.
function parseCsv(input) {
  // Normalize CRLF to LF
  const s = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let cur = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = "";
      } else if (ch === '\n') {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  // push last
  if (inQuotes) {
    // malformed csv, but include what we have
    row.push(cur);
    rows.push(row);
  } else if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// mapCsvRowToManpower(headerArray, rowArray)
// Header and row are arrays of strings. Mapping is robust to common header names.
function mapCsvRowToManpower(header, row) {
  const obj = {};
  for (let i = 0; i < header.length; i++) {
    const key = (header[i] || `COL_${i + 1}`).trim();
    const nkey = normalizeKey(key);
    const raw = i < row.length ? row[i] : "";
    obj[nkey] = cleanValue(raw);
  }

  // Derive canonical fields
  const out = {
    STAFF_NAME: pickFirst(obj, ["STAFF_NAME", "STAFF NAME", "NAME", "STAFF"], ""),
    POSITION: pickFirst(obj, ["POSITION", "ROLE"], ""),
    STATUS: pickFirst(obj, ["STATUS"], ""),
    // LOCATION historically stores the client name (displayed as "Client" in
    // the UI); SITE is the newer, genuine work-location field (displayed as
    // "Location"). A CSV column literally titled "Location" now maps to
    // SITE — use "Client" for the existing client-name field.
    LOCATION: pickFirst(obj, ["CLIENT"], ""),
    SITE: pickFirst(obj, ["SITE", "LOCATION"], ""),
    PO_SO_No: pickFirst(obj, ["PO_SO_NO", "PO/SO", "PO", "PO NO"], ""),
    START_DATE: pickFirst(obj, ["START_DATE", "START DATE", "START"], null),
    END_DATE: pickFirst(obj, ["END_DATE", "END DATE", "END"], null),
    END_DATE_KLSB: pickFirst(obj, ["END_DATE_KLSB", "END DATE KLSB", "END DATE KLSB"], null),
    Rate: toNumber(pickFirst(obj, ["RATE", "Rate"], null)),
    NH: pickFirst(obj, ["NH"], null),
    OT: toNumber(pickFirst(obj, ["OT"], null)),
  };

  // Preserve raw column values and the original header array so the UI
  // can reproduce the CSV verbatim and users can map any COL_n later.
  // Ensure we include columns beyond header length if present in row.
  const hdrs = (header || []).map((h) => (h == null ? "" : String(h).trim()));
  const max = Math.max(hdrs.length, row.length);
  const headersOut = [];
  for (let i = 0; i < max; i++) {
    const hdr = hdrs[i] || `COL_${i + 1}`;
    headersOut.push(hdr);
    const rawVal = i < row.length ? row[i] : "";
    out[`COL_${i + 1}`] = cleanValue(rawVal);
  }
  out.__headers = headersOut;

  return sanitizeForFirestore(out);
}

function normalizeKey(k) {
  return String(k || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pickFirst(obj, candidates, fallback) {
  for (const c of candidates) {
    const k = normalizeKey(c);
    if (k in obj && obj[k] !== "") return obj[k];
  }
  return fallback;
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[, ]+/g, ""));
  return Number.isNaN(n) ? null : n;
}

function cleanValue(v) {
  if (v == null) return "";
  const s = String(v).trim();
  return s === "" ? "" : s;
}

function sanitizeForFirestore(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "") out[k] = null;
    else out[k] = v;
  }
  return out;
}

// Heuristics to detect header rows in CSVs. Returns index of detected header or -1.
function detectHeader(rows, from = 0, to = 12) {
  const expected = ["BIL", "STAFF", "STAFF NAME", "STAFF_NAME", "POSITION", "RATE", "PO", "PO/SO", "NH", "OT"];
  for (let i = from; i <= to && i < rows.length; i++) {
    const r = rows[i] || [];
    let score = 0;
    for (const cell of r) {
      if (!cell) continue;
      const s = String(cell).toUpperCase().replace(/[^A-Z0-9 ]+/g, " ");
      for (const e of expected) if (s.includes(e)) score += 1;
    }
    // header if at least 2 expected tokens found
    if (score >= 2) return i;
  }
  return -1;
}

function looksLikeHeader(row) {
  if (!row || !Array.isArray(row)) return false;
  let count = 0;
  for (const cell of row) {
    if (!cell) continue;
    const s = String(cell).trim();
    // header cells are short and often non-numeric
    if (s.length > 0 && s.length < 40 && isNaN(Number(s))) count++;
  }
  return count >= Math.max(2, Math.min(6, Math.ceil(row.length / 4)));
}

export default {
  getManpowerData,
  importCsvToFirestore,
  importCsvTextToFirestore,
};

// Import CSV content (string) and write to Firestore — same behavior as importCsvToFirestore
export async function importCsvTextToFirestore(content, options = {}) {
  const opts = {
    collection: "manpower",
    headerRow: 6,
    startRow: 7,
    endRow: 223,
    batchSize: 500,
    ...options,
  };

  const rows = parseCsv(content || "");
  let headerIdx = opts.headerRow - 1;
  if (headerIdx < 0 || headerIdx >= rows.length) headerIdx = -1;
  if (headerIdx === -1 || !looksLikeHeader(rows[headerIdx])) {
    const detected = detectHeader(rows, 0, Math.min(rows.length - 1, 12));
    if (detected >= 0) headerIdx = detected;
  }
  if (headerIdx < 0 || headerIdx >= rows.length) throw new Error("headerRow out of bounds");
  const header = rows[headerIdx].map((h) => (h == null ? "" : String(h).trim()));
  const startIdx = Math.max(0, opts.startRow - 1);
  const endIdx = Math.min(rows.length - 1, opts.endRow - 1);
  if (startIdx > endIdx) throw new Error("Invalid startRow/endRow range");
  const dataRows = rows.slice(startIdx, endIdx + 1);
  const docs = dataRows.map((r) => mapCsvRowToManpower(header, r));

  const admin = await initAdmin();
  const db = admin.firestore();
  const colRef = db.collection(opts.collection);

  let imported = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < docs.length; i += opts.batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + opts.batchSize);
    for (const doc of chunk) {
      const docRef = colRef.doc();
      batch.set(docRef, doc, { merge: true });
    }
    try {
      await batch.commit();
      imported += chunk.length;
    } catch (e) {
      failed += chunk.length;
      errors.push({ chunkStart: i, error: e?.message || String(e) });
    }
  }

  return { imported, failed, errors };
}
