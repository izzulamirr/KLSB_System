import initAdmin from "./firebaseAdmin";

const DEFAULT_EMAIL_NOTIFICATIONS = true;

function getCollectionName() {
  return process.env.USER_PREFERENCES_COLLECTION || "user_preferences";
}

export async function getEmailNotificationsEnabled(uid) {
  const admin = await initAdmin();
  const snap = await admin.firestore().collection(getCollectionName()).doc(uid).get();
  if (!snap.exists) return DEFAULT_EMAIL_NOTIFICATIONS;
  const value = snap.data()?.emailNotificationsEnabled;
  return value === undefined ? DEFAULT_EMAIL_NOTIFICATIONS : Boolean(value);
}

export async function setEmailNotificationsEnabled(uid, enabled) {
  const admin = await initAdmin();
  await admin.firestore().collection(getCollectionName()).doc(uid).set(
    {
      emailNotificationsEnabled: Boolean(enabled),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// Drops recipients who have a portal account and explicitly opted out of
// email notifications. Addresses with no account (e.g. external PICs) have
// nothing to opt out of, so they keep receiving these emails by default.
export async function filterEmailNotificationRecipients(emails) {
  const list = Array.isArray(emails) ? emails.filter(Boolean) : [];
  if (list.length === 0) return [];

  const admin = await initAdmin();
  const auth = admin.auth();

  const results = await Promise.all(
    list.map(async (email) => {
      try {
        const userRecord = await auth.getUserByEmail(email);
        const enabled = await getEmailNotificationsEnabled(userRecord.uid);
        return enabled ? email : null;
      } catch {
        return email;
      }
    })
  );

  return results.filter(Boolean);
}
