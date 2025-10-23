// lib/sheets.js
import path from "path";
import fs from "fs";
import { google } from "googleapis";

export async function readSheet(range = process.env.GOOGLE_SHEETS_RANGE) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID not set");

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set");

  const abs = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
  if (!fs.existsSync(abs)) throw new Error(`Service account file not found: ${abs}`);

  const creds = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (creds.type !== "service_account" || !creds.client_email) {
    throw new Error("Provided JSON is not a service account key (missing type=service_account or client_email).");
  }

  console.log("[Sheets] Using service account:", creds.client_email);
  console.log("[Sheets] Spreadsheet ID:", spreadsheetId);
  console.log("[Sheets] Range:", range);

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const authClient = await auth.getClient(); // IMPORTANT

  const sheets = google.sheets({ version: "v4", auth: authClient });

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const values = res.data.values || [];
    if (!values.length) return [];

    const [header, ...rows] = values;
    return rows.map(r =>
      header.reduce((o, k, i) => {
        o[(k || `col_${i + 1}`).trim()] = r[i] ?? "";
        return o;
      }, {})
    );
  } catch (err) {
    // Show detailed API error
    const detail = err?.response?.data || err?.message || err;
    console.error("[Sheets] API error:", detail);
    throw err;
  }
}
