const admin = require('firebase-admin');
const path = require('path');

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error('Usage: node check-activation-token.js <token>');
    process.exit(2);
  }

  const servicePath = path.join(__dirname, '..', 'secrets', 'klsb-service-account.json');
  let serviceAccount;
  try {
    serviceAccount = require(servicePath);
  } catch (err) {
    console.error('Failed to load service account at', servicePath, err.message || err);
    process.exit(3);
  }

  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();
    const roleCollection = process.env.USER_ROLES_COLLECTION || 'user_roles';
    const snapshot = await db.collection(roleCollection).where('activationToken', '==', token).limit(1).get();
    if (snapshot.empty) {
      console.log('NOT_FOUND');
      process.exit(0);
    }
    const doc = snapshot.docs[0];
    const data = doc.data();
    console.log('FOUND');
    console.log('docId:', doc.id);
    const out = { ...data };
    if (out.activationExpiresAt && out.activationExpiresAt.toDate) {
      out.activationExpiresAt = out.activationExpiresAt.toDate().toISOString();
    }
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exit(4);
  }
}

main();
