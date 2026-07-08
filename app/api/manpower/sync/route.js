import initAdmin from '../../../../lib/firebaseAdmin';
import { NextResponse } from 'next/server';

async function verifyToken(req, admin) {
  const auth = req.headers.get('authorization') || '';
  const idToken = auth.replace('Bearer ', '');
  if (!idToken) throw new Error('No ID token provided');
  return admin.auth().verifyIdToken(idToken);
}

async function getSheetsClient() {
  const { google } = await import('googleapis');
  const { GoogleAuth } = google.auth;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new GoogleAuth({ keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, scopes });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const auth = new GoogleAuth({ credentials: creds, scopes });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  }
  return null;
}

function headerToFieldValue(header, doc) {
  if (!header) return '';
  const h = String(header).toLowerCase();
  if (h.includes('staff') || h.includes('name')) return doc.STAFF_NAME ?? '';
  if (h.includes('position') || h.includes('role')) return doc.POSITION ?? '';
  if (h.includes('status')) return doc.STATUS ?? '';
  // LOCATION historically stores the client name (shown as "Client" in the
  // UI); SITE is the newer work-location field (shown as "Location").
  if (h.includes('client')) return doc.LOCATION ?? '';
  if (h.includes('site') || h.includes('location')) return doc.SITE ?? '';
  if (h.includes('po') || h.includes('so') || h.includes('secondment')) return doc.PO_SO_No ?? '';
  if (h.includes('start')) return doc.START_DATE ?? '';
  if (h.includes('end')) return doc.END_DATE ?? '';
  if (h.includes('extension') || h.includes('ext')) return doc.EXTENSION_STATUS ?? '';
  if (h.includes('nh') || h.includes('night')) return (doc.NH !== undefined && doc.NH !== null) ? String(doc.NH) : '';
  // Rate headers (e.g. "KLSB OT Rate", "KLSB Rate") must be checked before the
  // plain OT-hours check below, since they also contain the substring "ot".
  if (h.includes('rate')) {
    if (h.includes('ot')) return (doc.KLSB_RATE_OT !== undefined && doc.KLSB_RATE_OT !== null) ? String(doc.KLSB_RATE_OT) : '';
    if (h.includes('nh') || h.includes('normal')) return (doc.KLSB_RATE_NORMAL !== undefined && doc.KLSB_RATE_NORMAL !== null) ? String(doc.KLSB_RATE_NORMAL) : '';
    return (doc.Rate !== undefined && doc.Rate !== null) ? String(doc.Rate) : '';
  }
  if (h.includes('ot') || h.includes('overtime')) return (doc.OT !== undefined && doc.OT !== null) ? String(doc.OT) : '';
  return (doc[header] !== undefined && doc[header] !== null) ? String(doc[header]) : '';
}

export async function POST(req) {
  try {
    const { admin, db } = await (async () => {
      const a = await initAdmin();
      return { admin: a, db: a.firestore() };
    })();
    await verifyToken(req, admin);

    const body = await req.json();
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const docId = body.id;
    const docSnap = await db.collection(process.env.MANPOWER_COLLECTION_NAME || 'manpower').doc(docId).get();
    if (!docSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const doc = { id: docSnap.id, ...docSnap.data() };

    const sheetId = doc.SHEET_ID;
    const sheetRow = doc.SHEET_ROW;
    if (!sheetId || !sheetRow) return NextResponse.json({ ok: false, reason: 'no-sheet-metadata' });

    const sheets = await getSheetsClient();
    if (!sheets) return NextResponse.json({ ok: false, reason: 'no-sheets-client' });

    // Determine tab
    let tabName = doc.SHEET_NAME;
    if (!tabName) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const first = (meta.data && meta.data.sheets && meta.data.sheets[0]);
      tabName = first && first.properties && first.properties.title ? first.properties.title : null;
    }
    if (!tabName) return NextResponse.json({ ok: false, reason: 'no-tab-name' });

    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tabName}!1:1` });
    const headers = (headerRes.data && headerRes.data.values && headerRes.data.values[0]) ? headerRes.data.values[0] : [];
    const values = headers.map(h => headerToFieldValue(h, doc));
    const range = `${tabName}!A${Number(sheetRow)}`;

    // Re-read the doc right before writing to the sheet: if it changed since
    // we first read it (e.g. a concurrent PUT to /api/manpower), the values
    // we built above are stale — bail out instead of overwriting the sheet
    // with outdated data, so the caller can retry against the latest doc.
    const recheckSnap = await db.collection(process.env.MANPOWER_COLLECTION_NAME || 'manpower').doc(docId).get();
    const recheckUpdatedAt = recheckSnap.exists ? recheckSnap.data()?.updatedAt : null;
    const initialUpdatedAt = doc.updatedAt || null;
    const initialMillis = initialUpdatedAt?.toMillis ? initialUpdatedAt.toMillis() : initialUpdatedAt;
    const recheckMillis = recheckUpdatedAt?.toMillis ? recheckUpdatedAt.toMillis() : recheckUpdatedAt;
    const changedSinceRead = initialMillis !== recheckMillis;
    if (changedSinceRead) {
      return NextResponse.json({ ok: false, reason: 'stale-doc', message: 'Record changed during sync; retry.' }, { status: 409 });
    }

    await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range, valueInputOption: 'RAW', requestBody: { values: [values] } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Sync endpoint error:', err && err.stack ? err.stack : err);
    const status = err && err.message && err.message.includes('No ID token') ? 401 : 500;
    return NextResponse.json({ error: String(err && err.message ? err.message : err) }, { status });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, note: 'manpower sync endpoint' });
}
