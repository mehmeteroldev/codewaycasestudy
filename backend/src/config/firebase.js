const admin = require('firebase-admin');
const env = require('./env');

let app;

const initFirebase = () => {
  if (app) return app;

  if (env.firebase.serviceAccountJson) {
    const creds = JSON.parse(env.firebase.serviceAccountJson);
    app = admin.initializeApp({
      credential: admin.credential.cert(creds),
    });
  } else if (env.firebase.applicationCredentials) {
    // firebase-admin picks up GOOGLE_APPLICATION_CREDENTIALS automatically
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    throw new Error(
      'Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  return app;
};

initFirebase();

module.exports = {
  admin,
  auth: admin.auth(),
  firestore: admin.firestore(),
  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp,
};
