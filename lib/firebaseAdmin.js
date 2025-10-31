// lib/firebaseAdmin.js
// Lazy-initialize the Firebase Admin SDK at runtime so Next.js builds don't fail
// when the package isn't installed in environments where it's not needed.

async function initAdmin() {
  let admin;
  try {
    // require at runtime so missing dependency doesn't break static analysis/build
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    admin = require("firebase-admin");
  } catch {
    throw new Error(
      "The 'firebase-admin' package is not installed. Run 'npm install firebase-admin' in the project root or add it to your package manager before starting the server."
    );
  }

  if (admin.apps && admin.apps.length) return admin;

  const credJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credJson) {
    // Try GOOGLE_APPLICATION_CREDENTIALS fallback (GCP default)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      return admin;
    }
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required to initialize Admin SDK. Alternatively set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path."
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(credJson);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON: " + e.message);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

export default initAdmin;
