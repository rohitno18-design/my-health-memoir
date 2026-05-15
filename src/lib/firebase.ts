import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// ─── PROJECT CONFIG: im-smrti ─────────────────────────────────────────────────
// Env vars are injected at build time. Fallback values ensure CI builds without
// secrets still produce a working app (Firebase client keys are not secret —
// security is enforced entirely via Firestore/Storage rules).
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyC5c1HePuiM84Z8qqhJJH603K0uIwo-JGQ",
    authDomain: "imsmrti.app",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "im-smrti",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "im-smrti.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "541123545766",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:541123545766:web:c4266829082bd3ef1cc267",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-2P2P5KYKBK",
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

// Initialize App Check (reCAPTCHA v3) — prevents unverified clients
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaKey && typeof window !== "undefined") {
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
    });
}

export { analytics };
export default app;
