(async () => {
  try {
    // Dynamic import so we match the project's module style
    const initAdmin = (await import('../lib/firebaseAdmin.js')).default;
    const admin = await initAdmin();

    console.log('Admin SDK initialized. Project ID:', admin.app?.options?.projectId || '(unknown)');

    // Try a simple Firestore call: list collections (requires Firestore enabled in project)
    if (admin.firestore) {
      const cols = await admin.firestore().listCollections();
      console.log('Found collections:', cols.map(c => c.id).join(', ') || '(none)');
    } else {
      console.log('Firestore is not available on admin object.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Admin SDK initialization failed:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
