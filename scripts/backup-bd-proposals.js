#!/usr/bin/env node
// scripts/backup-bd-proposals.js
// Local backup for the Firestore bd_proposals collection.
// Usage:
//   node scripts/backup-bd-proposals.js
// Optional:
//   --output <file>   Write to a custom JSON file path
//   --collection <id> Override the collection name
// Environment:
//   GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON must be set
//   .env.local is loaded automatically when present

const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');

// Load local environment configuration first so the Firebase Admin SDK can initialize.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function initAdmin() {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (error) {
    console.error("firebase-admin is not installed. Run: npm install firebase-admin");
    process.exit(1);
  }

  if (admin.apps && admin.apps.length) return admin;

  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON:', error.message);
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      serviceAccount = require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
    } catch (error) {
      console.error('Failed to load GOOGLE_APPLICATION_CREDENTIALS file:', error.message);
      process.exit(1);
    }
  } else {
    console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS before running.');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin;
}

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);
  return index >= 0 ? process.argv[index + 1] : null;
}

function getCollectionName() {
  return getArgValue('--collection') || process.env.BD_PROPOSALS_COLLECTION || 'bd_proposals';
}

function getOutputPath(collectionName) {
  const provided = getArgValue('--output');
  if (provided) return path.resolve(provided);

  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\.[0-9]{3}Z$/, 'Z');
  return path.resolve(process.cwd(), 'backups', collectionName, `${collectionName}-${stamp}.json`);
}

function serializeValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value !== 'object') return value;

  // Firestore Timestamp
  if (typeof value.toDate === 'function' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return { _type: 'timestamp', value: value.toDate().toISOString() };
  }

  // Firestore GeoPoint
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { _type: 'geoPoint', latitude: value.latitude, longitude: value.longitude };
  }

  // Firestore DocumentReference
  if (typeof value.path === 'string' && Object.keys(value).length <= 2) {
    return { _type: 'documentReference', path: value.path };
  }

  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = serializeValue(nested);
  }
  return output;
}

async function fetchAllDocuments(db, collectionName) {
  const admin = await initAdmin();
  const pageSize = 500;
  const docs = [];
  let lastDoc = null;

  while (true) {
    let query = db.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      docs.push({
        id: doc.id,
        path: doc.ref.path,
        exists: doc.exists,
        data: serializeValue(doc.data()),
      });
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  }

  return docs;
}

async function main() {
  const collectionName = getCollectionName();
  const outputPath = getOutputPath(collectionName);
  const admin = await initAdmin();
  const db = admin.firestore();

  console.log(`Backing up Firestore collection: ${collectionName}`);
  const documents = await fetchAllDocuments(db, collectionName);

  const backup = {
    collection: collectionName,
    exportedAt: new Date().toISOString(),
    documentCount: documents.length,
    documents,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`Backup written to: ${outputPath}`);
  console.log(`Documents exported: ${documents.length}`);
}

main().catch((error) => {
  console.error('Backup failed:', error);
  process.exit(1);
});
