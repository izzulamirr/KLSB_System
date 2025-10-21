// firebase.js (root)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// —— paste your real values below ——
const firebaseConfig = {
  apiKey: "AIzaSyC7W1OPTTPpNVZWr_CIuQulFE2Rai9XfM0",
  authDomain: "klsb-portal.firebaseapp.com",
  projectId: "klsb-portal",
  storageBucket: "klsb-portal.appspot.com", // <- note .appspot.com
  messagingSenderId: "431652906449",
  appId: "1:431652906449:web:a3011946996a49ea682cf0",
};

// Initialize Firebase (use singleton to avoid duplicate-app errors in Next.js)
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Only initialize analytics in the browser; getAnalytics can throw on SSR.
let analytics = null;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(firebaseApp);
  } catch (e) {
    // Analytics not available (e.g., blocked, or running in non-browser env). Ignore.
    analytics = null;
  }
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export default firebaseApp;