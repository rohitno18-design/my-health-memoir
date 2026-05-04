import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// ─── NEW PROJECT CONFIG ────────────────────────────────────────────────────────
// All keys come from .env — see .env file for setup instructions.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "imsmrti.app",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Secondary App for Admin operations (creating accounts silently)
const adminApp = initializeApp(firebaseConfig, "adminApp");
export const adminAuth = getAuth(adminApp);

// Enable offline persistence via IndexedDB — data survives offline/airplane mode
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const storage = getStorage(app);

// Initialize Analytics in the browser only
let analytics = null;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}

export { analytics };
export default app;
