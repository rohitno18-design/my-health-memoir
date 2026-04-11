import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile as firebaseUpdateProfile,
    updatePassword as firebaseUpdatePassword,
    sendEmailVerification,
    verifyBeforeUpdateEmail,
    sendPasswordResetEmail,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reload,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    linkWithPhoneNumber,
    linkWithCredential,
    type ConfirmationResult,
    type User,
} from "firebase/auth";
import {
    doc, getDoc, setDoc, deleteDoc, serverTimestamp, query,
    collection, where, getDocs, addDoc
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
    bio: string | null;
    gender: string | null;
    dob: string | null;
    bloodGroup: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    role: "patient" | "admin";
    createdAt?: unknown;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    isAdmin: boolean;
    isFullyVerified: boolean;
    login: (email: string, password: string) => Promise<void>;
    registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    resendVerification: () => Promise<void>;
    refreshUser: () => Promise<void>;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
    updateUserEmail: (newEmail: string, currentPassword: string) => Promise<void>;
    updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    deleteAccount: () => Promise<void>;
    uploadProfilePhoto: (file: File, onProgress?: (p: number) => void) => Promise<string>;
    getRecaptchaVerifier: (containerId: string) => RecaptchaVerifier;
    sendPhoneOtp: (phoneNumber: string, containerId: string) => Promise<ConfirmationResult>;
    linkPhoneToAccount: (phoneNumber: string, containerId: string) => Promise<ConfirmationResult>;
    linkEmailToAccount: (email: string, password: string) => Promise<void>;
    checkPhoneUnique: (phoneNumber: string) => Promise<boolean>;
    logSecurityActivity: (type: string, oldValue: string, newValue: string, metadata?: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    /** Fetch the Firestore user document. If missing, create it. */
    const fetchOrCreateProfile = async (firebaseUser: User) => {
        const docRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            // Update verification status from Firebase Auth
            const data = snap.data() as UserProfile;
            const updates: Partial<UserProfile> = {};
            if (firebaseUser.emailVerified && !data.emailVerified) {
                updates.emailVerified = true;
            }
            if (firebaseUser.phoneNumber && !data.phoneVerified) {
                updates.phoneVerified = true;
                updates.phoneNumber = firebaseUser.phoneNumber;
            }
            // CRITICAL: Sync email if changed in Auth (e.g. after verification)
            if (firebaseUser.email && firebaseUser.email !== data.email) {
                const oldEmail = data.email || "unknown";
                updates.email = firebaseUser.email;
                updates.emailVerified = firebaseUser.emailVerified;
                // Clear pending email since the change is now complete
                (updates as any).pendingEmail = null;

                // Log the finalization of the email change
                await internalLogActivity(firebaseUser.uid, "EMAIL_CHANGE_COMPLETED", oldEmail, firebaseUser.email, {
                    message: "User verified new email and profile has been synchronized."
                });
            }
            if (Object.keys(updates).length > 0) {
                await setDoc(docRef, updates, { merge: true });
            }
            setUserProfile({ ...data, ...updates });
        } else {
            const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                phoneNumber: firebaseUser.phoneNumber,
                photoURL: firebaseUser.photoURL,
                bio: null,
                gender: null,
                dob: null,
                bloodGroup: null,
                emailVerified: firebaseUser.emailVerified,
                phoneVerified: !!firebaseUser.phoneNumber,
                role: "patient",
                createdAt: serverTimestamp(),
            };
            await setDoc(docRef, newProfile);
            setUserProfile(newProfile);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                await fetchOrCreateProfile(firebaseUser);
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // ────────────── ReCAPTCHA management ──────────────
    const getRecaptchaVerifier = (containerId: string): RecaptchaVerifier => {
        // Always clear the old verifier to prevent "element removed" error
        if ((window as any).recaptchaVerifier) {
            try { (window as any).recaptchaVerifier.clear(); } catch { /* ignore */ }
            (window as any).recaptchaVerifier = null;
        }

        // Ensure the container exists
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`ReCAPTCHA container #${containerId} not found in DOM`);
            // Fallback: create one
            const fallback = document.createElement("div");
            fallback.id = containerId;
            document.body.appendChild(fallback);
        }

        const verifier = new RecaptchaVerifier(auth, containerId, {
            size: "invisible",
            callback: () => console.log("reCAPTCHA solved"),
            'expired-callback': () => console.log("reCAPTCHA expired")
        });
        (window as any).recaptchaVerifier = verifier;
        return verifier;
    };

    // ────────────── Login ──────────────
    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
        // No email-verification blocking here — the VerificationGate handles that
    };

    // ────────────── Register with Email ──────────────
    const registerWithEmail = async (email: string, password: string, name: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await firebaseUpdateProfile(cred.user, { displayName: name });
        // Send verification email
        await sendEmailVerification(cred.user);
        // Create Firestore profile
        const profile: UserProfile = {
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: name,
            phoneNumber: null,
            photoURL: null,
            bio: null,
            gender: null,
            dob: null,
            bloodGroup: null,
            emailVerified: false, // Will become true when they click the email link
            phoneVerified: false,
            role: "patient",
            createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", cred.user.uid), profile, { merge: true });
        setUserProfile(profile);
        // User stays signed in — the VerificationGate will prompt them
    };

    // ────────────── Phone OTP (for login) ──────────────
    const sendPhoneOtp = async (phoneNumber: string, containerId: string) => {
        const verifier = getRecaptchaVerifier(containerId);
        return signInWithPhoneNumber(auth, phoneNumber, verifier);
    };

    // ────────────── Link phone to existing account ──────────────
    const linkPhoneToAccount = async (phoneNumber: string, containerId: string) => {
        if (!auth.currentUser) throw new Error("Not authenticated");
        const verifier = getRecaptchaVerifier(containerId);
        return linkWithPhoneNumber(auth.currentUser, phoneNumber, verifier);
    };

    // ────────────── Link email/password to existing phone account ──────────────
    const linkEmailToAccount = async (email: string, password: string) => {
        if (!auth.currentUser) throw new Error("Not authenticated");
        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(auth.currentUser, credential);
        // Send verification email
        await sendEmailVerification(auth.currentUser);
        // Update Firestore
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            email,
            emailVerified: false,
        }, { merge: true });
        setUserProfile(prev => prev ? { ...prev, email, emailVerified: false } : prev);
    };

    // ────────────── Check phone uniqueness ──────────────
    const checkPhoneUnique = async (phoneNumber: string): Promise<boolean> => {
        const q = query(collection(db, "users"), where("phoneNumber", "==", phoneNumber));
        const snap = await getDocs(q);
        return snap.empty;
    };

    const logout = async () => {
        // Clean up recaptcha
        if ((window as any).recaptchaVerifier) {
            try { (window as any).recaptchaVerifier.clear(); } catch { /* ignore */ }
            (window as any).recaptchaVerifier = null;
        }
        await signOut(auth);
        setUserProfile(null);
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const deleteAccount = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteUser(currentUser);
        setUserProfile(null);
    };

    /** Re-sends the email verification link */
    const resendVerification = async () => {
        if (!auth.currentUser) throw new Error("Not authenticated");
        await sendEmailVerification(auth.currentUser);
    };

    /** Reloads the Firebase Auth user to pick up emailVerified changes */
    const refreshUser = async () => {
        if (!auth.currentUser) return;
        await reload(auth.currentUser);
        // Do NOT spread {...auth.currentUser} as it loses internal Firebase methods
        setUser(auth.currentUser);
        // Re-sync profile with latest verification status
        await fetchOrCreateProfile(auth.currentUser);
    };

    const updateUserProfile = async (data: Partial<UserProfile>) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");
        const authUpdates: { displayName?: string; photoURL?: string } = {};
        if (data.displayName !== undefined) authUpdates.displayName = data.displayName ?? undefined;
        if (data.photoURL !== undefined) authUpdates.photoURL = data.photoURL ?? undefined;
        if (Object.keys(authUpdates).length > 0) {
            await firebaseUpdateProfile(currentUser, authUpdates);
        }
        await setDoc(doc(db, "users", currentUser.uid), data as Record<string, unknown>, { merge: true });
        setUserProfile(prev => prev ? { ...prev, ...data } : prev);
    };

    const updateUserEmail = async (newEmail: string, currentPassword: string) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");

        // CRITICAL: Force reload the Auth user FIRST to pick up any email changes
        // that happened since the last page load (e.g. user verified a previous
        // email change in another tab). Without this, currentUser.email could be
        // stale (e.g. still email1 even though user verified email2), and Firebase
        // would send the security warning to the stale email.
        await reload(currentUser);
        // Update React state with the refreshed user
        setUser(auth.currentUser);

        // Now currentUser.email reflects the LATEST Auth email from the server
        const freshEmail = currentUser.email;

        // Re-authenticate with the FRESH email
        if (freshEmail) {
            const cred = EmailAuthProvider.credential(freshEmail, currentPassword);
            await reauthenticateWithCredential(currentUser, cred);
        } else {
            // If phone-only, we need to link the email/password first
            const credential = EmailAuthProvider.credential(newEmail, currentPassword);
            await linkWithCredential(currentUser, credential);
        }

        // Use the modern API that sends a verification link to the NEW address
        // The email in Auth only updates AFTER the user clicks the link.
        // The security warning goes to freshEmail (the current Auth email on the server).
        await verifyBeforeUpdateEmail(currentUser, newEmail);

        // Store the pending email in Firestore so the UI can show what's pending
        // We do NOT change the main 'email' field — that only updates after verification.
        await setDoc(doc(db, "users", currentUser.uid), {
            pendingEmail: newEmail,
        }, { merge: true });

        // Also sync Firestore email with the fresh Auth email if they were out of sync
        // (from a previously completed verification that Firestore didn't catch)
        if (freshEmail) {
            const docRef = doc(db, "users", currentUser.uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.email !== freshEmail) {
                    await setDoc(docRef, { email: freshEmail, emailVerified: currentUser.emailVerified }, { merge: true });
                    setUserProfile(prev => prev ? { ...prev, email: freshEmail, emailVerified: currentUser.emailVerified } : prev);
                }
            }
        }
    };

    const updateUserPassword = async (currentPassword: string, newPassword: string) => {
        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) throw new Error("Email user not found");
        const cred = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, cred);
        await firebaseUpdatePassword(currentUser, newPassword);
    };

    const uploadProfilePhoto = async (file: File, onProgress?: (p: number) => void): Promise<string> => {
        if (!user) throw new Error("Not authenticated");
        const storageRef = ref(storage, `profile-photos/${user.uid}`);
        return new Promise((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, file);
            task.on(
                "state_changed",
                (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                (error) => reject(error),
                async () => {
                    const url = await getDownloadURL(task.snapshot.ref);
                    resolve(url);
                }
            );
        });
    };

    const internalLogActivity = async (uid: string, type: string, oldValue: string, newValue: string, metadata: any = {}) => {
        try {
            const logRef = collection(db, "users", uid, "securityLogs");
            await addDoc(logRef, {
                type,
                oldValue,
                newValue,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent,
                ip: "Client-side (Approximate)",
                ...metadata
            });
            console.log(`✅ Security Log PERSISTED: ${type}`);
        } catch (error) {
            console.error("❌ Failed to PERSIST security activity:", error);
        }
    };

    const logSecurityActivity = async (type: string, oldValue: string, newValue: string, metadata: any = {}) => {
        if (!auth.currentUser) return;
        await internalLogActivity(auth.currentUser.uid, type, oldValue, newValue, metadata);
    };

    const isFullyVerified = !!(userProfile?.emailVerified && userProfile?.phoneVerified);

    return (
        <AuthContext.Provider value={{
            user, userProfile, loading,
            isAdmin: userProfile?.role === "admin",
            isFullyVerified,
            login, registerWithEmail, logout,
            resetPassword, deleteAccount,
            resendVerification, refreshUser,
            updateUserProfile, updateUserEmail, updateUserPassword, uploadProfilePhoto,
            getRecaptchaVerifier, sendPhoneOtp, linkPhoneToAccount, linkEmailToAccount,
            checkPhoneUnique,
            logSecurityActivity,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
