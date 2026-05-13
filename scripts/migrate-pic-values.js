#!/usr/bin/env node
// scripts/migrate-pic-values.js
// Rewrites old PIC values in the BD proposals collection so they are stored
// as comma-separated, deduplicated PIC codes instead of slash-separated text.
//
// Usage:
//   node scripts/migrate-pic-values.js [--apply]
//
// Environment:
//   FIREBASE_SERVICE_ACCOUNT_JSON - service account JSON string
//   OR GOOGLE_APPLICATION_CREDENTIALS - path to a service account JSON file
//   BD_PROPOSALS_COLLECTION - optional, defaults to 'bd_proposals'

const readline = require("readline");

function parsePicString(picString) {
  if (!picString) return [];
  const normalized = String(picString).replace(/[\/;&\n]+/g, ",");
  const pieces = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((code) => code.toUpperCase());

  return [...new Set(pieces)];
}

function formatPicString(picValue) {
  return parsePicString(picValue).join(", ");
}

async function initAdmin() {
  let admin;
  try {
    admin = require("firebase-admin");
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
      console.error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON:", error.message);
      process.exit(1);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } catch (error) {
      console.error("Failed to load GOOGLE_APPLICATION_CREDENTIALS file:", error.message);
      process.exit(1);
    }
  } else {
    console.error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS before running.");
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

function getCollectionName() {
  return process.env.BD_PROPOSALS_COLLECTION || "bd_proposals";
}

async function main() {
  const applyChanges = process.argv.includes("--apply");
  const admin = await initAdmin();
  const db = admin.firestore();
  const collectionName = getCollectionName();

  const snapshot = await db.collection(collectionName).get();
  const updates = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const original = String(data.personInCharge || "");
    const normalized = formatPicString(original);
    if (normalized && normalized !== original) {
      updates.push({ id: doc.id, original, normalized });
    }
  });

  console.log(`Collection: ${collectionName}`);
  console.log(`Documents scanned: ${snapshot.size}`);
  console.log(`Documents needing update: ${updates.length}`);

  if (updates.length === 0) {
    console.log("No PIC values need migration.");
    process.exit(0);
  }

  updates.slice(0, 25).forEach((item) => {
    console.log(`- ${item.id}: ${item.original} -> ${item.normalized}`);
  });

  if (!applyChanges) {
    console.log("Dry run only. Re-run with --apply to write the updates.");
    process.exit(0);
  }

  const answer = await confirmPrompt(`Type the collection name (${collectionName}) to confirm migration: `);
  if (answer !== collectionName) {
    console.log("Confirmation did not match. Aborting.");
    process.exit(0);
  }

  const batchSize = 400;
  let updatedCount = 0;

  for (let index = 0; index < updates.length; index += batchSize) {
    const chunk = updates.slice(index, index + batchSize);
    const batch = db.batch();

    for (const item of chunk) {
      batch.update(db.collection(collectionName).doc(item.id), {
        personInCharge: item.normalized,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    updatedCount += chunk.length;
    console.log(`Updated ${updatedCount}/${updates.length} documents...`);
  }

  console.log(`Done. Migrated ${updatedCount} documents in '${collectionName}'.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});