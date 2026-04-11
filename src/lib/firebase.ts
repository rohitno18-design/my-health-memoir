import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Wait to initialize Analytics and App Check until running strictly in the browser
let analytics = null;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
    
    // Enable debug mode for App Check if in development mode
    if (import.meta.env.DEV) {
        (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    
    // Using a dummy key until the Google Cloud project generates a real reCAPTCHA Enterprise key
    const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
    
    try {
        initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
            isTokenAutoRefreshEnabled: true
        });
        console.log("Firebase App Check initialized.");
    } catch (e) {
        console.error("Firebase App Check failed to initialize", e);
    }
}

export { analytics };
export default app;
