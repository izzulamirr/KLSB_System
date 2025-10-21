#!/usr/bin/env node
// scripts/clear-manpower.js
// Safely delete all documents in the configured manpower collection.
// Usage:
//   node scripts/clear-manpower.js
// Environment:
//   FIREBASE_SERVICE_ACCOUNT_JSON - service account JSON string (preferred)
//   OR GOOGLE_APPLICATION_CREDENTIALS - path to service account JSON file
//   MANPOWER_COLLECTION_NAME - optional, default 'manpower'

const readline = require('readline');

async function initAdmin() {
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    console.error("'firebase-admin' is not installed. Run: npm install firebase-admin");
    process.exit(1);
  }

  if (admin.apps && admin.apps.length) return admin;

  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON:', e.message);
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } catch (e) {
      console.error('Failed to load GOOGLE_APPLICATION_CREDENTIALS file:', e.message);
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

async function confirmPrompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function deleteCollection(db, collectionPath) {
  // Delete in batches to avoid memory pressure
  const batchSize = 500;
  let totalDeleted = 0;
  while (true) {
    const snapshot = await db.collection(collectionPath).limit(batchSize).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`Deleted ${totalDeleted} documents...`);
    if (snapshot.size < batchSize) break;
  }
  return totalDeleted;
}

async function main() {
  const admin = await initAdmin();
  const db = admin.firestore();
  const collectionName = process.env.MANPOWER_COLLECTION_NAME || 'manpower';

  console.log('This script will DELETE ALL documents in collection:', collectionName);
  const snap = await db.collection(collectionName).get();
  console.log('Document count:', snap.size);

  const answer = await confirmPrompt("Type the collection name to confirm deletion: ");
  if (answer !== collectionName) {
    console.log('Confirmation did not match. Aborting.');
    process.exit(0);
  }

  console.log('Deleting...');
  const deleted = await deleteCollection(db, collectionName);
  console.log(`Done. Deleted ${deleted} documents from '${collectionName}'.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
