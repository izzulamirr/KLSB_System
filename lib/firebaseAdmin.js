// lib/firebaseAdmin.js
// Lazy-init Firebase Admin and accept either inline JSON or a file path.

import path from "path";
import fs from "fs";

async function initAdmin() {
  let admin;
  try {
    // require at runtime so it won't break builds if not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    admin = require("firebase-admin");
  } catch {
    throw new Error(
      "The 'firebase-admin' package is not installed. Run 'npm install firebase-admin'."
    );
  }

  // Reuse existing app if already initialized
  if (admin.apps && admin.apps.length) return admin;

  // 1) Prefer inline JSON (FIREBASE_SERVICE_ACCOUNT_JSON)
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    let svc;
    try {
      svc = JSON.parse(inlineJson);
    } catch (e) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON: " + e.message
      );
    }
    admin.initializeApp({ credential: admin.credential.cert(svc) });
    return admin;
  }

  // 2) Fallback to file path (GOOGLE_APPLICATION_CREDENTIALS)
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    // Resolve relative paths against the project root (process.cwd())
    const absPath = path.isAbsolute(credPath)
      ? credPath
      : path.resolve(process.cwd(), credPath);

    if (!fs.existsSync(absPath)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS file not found at: ${absPath}`
      );
    }

    let svcFromFile;
    try {
      const raw = fs.readFileSync(absPath, "utf8");
      svcFromFile = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        "Failed to read/parse GOOGLE_APPLICATION_CREDENTIALS file: " + e.message
      );
    }

    admin.initializeApp({ credential: admin.credential.cert(svcFromFile) });
    return admin;
  }

  // 3) Nothing provided
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS must be set to initialize Firebase Admin."
  );
}

export default initAdmin;
