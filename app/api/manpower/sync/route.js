import initAdmin from '../../../../lib/firebaseAdmin';
import { NextResponse } from 'next/server';

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
  if (h.includes('bil') || h.includes('no') || h.includes('id')) return doc.BIL ?? '';
  if (h.includes('staff') || h.includes('name')) return doc.STAFF_NAME ?? '';
  if (h.includes('position') || h.includes('role')) return doc.POSITION ?? '';
  if (h.includes('status')) return doc.STATUS ?? '';
  if (h.includes('location') || h.includes('client')) return doc.LOCATION ?? '';
  if (h.includes('po') || h.includes('so') || h.includes('secondment')) return doc.PO_SO_No ?? '';
  if (h.includes('start')) return doc.START_DATE ?? '';
  if (h.includes('end')) return doc.END_DATE ?? '';
  if (h.includes('extension') || h.includes('ext')) return doc.EXTENSION_STATUS ?? '';
  if (h.includes('nh') || h.includes('night')) return (doc.NH !== undefined && doc.NH !== null) ? String(doc.NH) : '';
  if (h.includes('ot') || h.includes('overtime')) return (doc.OT !== undefined && doc.OT !== null) ? String(doc.OT) : '';
  if (h.includes('rate') && !h.includes('nh') && !h.includes('ot')) return (doc.Rate !== undefined && doc.Rate !== null) ? String(doc.Rate) : '';
  return (doc[header] !== undefined && doc[header] !== null) ? String(doc[header]) : '';
}

export async function POST(req) {
  try {
    const { admin, db } = await (async () => {
      const a = await initAdmin();
      return { admin: a, db: a.firestore() };
    })();

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
    await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range, valueInputOption: 'RAW', requestBody: { values: [values] } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Sync endpoint error:', err && err.stack ? err.stack : err);
    return NextResponse.json({ error: String(err && err.message ? err.message : err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, note: 'manpower sync endpoint' });
}
