import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { logUserAction } from "@/lib/audit";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPhoneNumber,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile as firebaseUpdateProfile,
    updatePassword as firebaseUpdatePassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reload,
    verifyBeforeUpdateEmail,
    type User,
    type ConfirmationResult,
} from "firebase/auth";
import {
    doc, getDoc, setDoc, deleteDoc, serverTimestamp, addDoc, collection, onSnapshot
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

const actionCodeSettings = {
    url: "https://imsmrti.app",
    handleCodeInApp: false,
};

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
    suspended?: boolean;
    createdAt?: unknown;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    isAdmin: boolean;
    isFullyVerified: boolean;
    hasPassword: boolean;
    // Phone auth
    sendOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
    confirmOtp: (confirmationResult: ConfirmationResult, otp: string, name: string, email?: string) => Promise<void>;
    setupPhoneProfile: (name: string, email?: string) => Promise<void>;
    // Email auth (fallback)
    login: (email: string, password: string) => Promise<void>;
    registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    resendVerification: (pendingEmail?: string) => Promise<void>;
    refreshUser: () => Promise<void>;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
    updateUserEmail: (newEmail: string, currentPassword: string) => Promise<void>;
    updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    deleteAccount: () => Promise<void>;
    uploadProfilePhoto: (file: File, onProgress?: (p: number) => void) => Promise<string>;
    logSecurityActivity: (type: string, oldValue: string, newValue: string, metadata?: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    // Store recaptcha verifier instance ID so we can clear it before creating a new one
    const recaptchaVerifierRef = useRef<any>(null);
    const profileUnsubRef = useRef<(() => void) | null>(null);

    const fetchOrCreateProfile = async (firebaseUser: User) => {
        const docRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data() as UserProfile;
            const updates: Partial<UserProfile> = {};
            if (firebaseUser.emailVerified && !data.emailVerified) updates.emailVerified = true;
            if (firebaseUser.phoneNumber && !data.phoneVerified) {
                updates.phoneVerified = true;
                updates.phoneNumber = firebaseUser.phoneNumber;
            }
            if (firebaseUser.email && firebaseUser.email !== data.email) {
                const oldEmail = data.email || "unknown";
                updates.email = firebaseUser.email;
                updates.emailVerified = firebaseUser.emailVerified;
                (updates as any).pendingEmail = null;
                await internalLogActivity(firebaseUser.uid, "EMAIL_CHANGE_COMPLETED", oldEmail, firebaseUser.email, {
                    message: "User verified new email and profile has been synchronized."
                });
            }
            if (Object.keys(updates).length > 0) await setDoc(docRef, updates, { merge: true });
            setUserProfile({ ...data, ...updates });
            // Ensure lookup entries exist for existing profiles
            const email = firebaseUser.email || data.email;
            const phone = firebaseUser.phoneNumber || (data as any).phoneNumber;
            if (email) {
                const lookupRef = doc(db, "user_lookup", "email_" + btoa(email));
                const lookupSnap = await getDoc(lookupRef);
                if (!lookupSnap.exists()) {
                    await setDoc(lookupRef, { uid: firebaseUser.uid, email });
                }
            }
            if (phone) {
                const lookupRef = doc(db, "user_lookup", "phone_" + phone);
                const lookupSnap = await getDoc(lookupRef);
                if (!lookupSnap.exists()) {
                    await setDoc(lookupRef, { uid: firebaseUser.uid, phone });
                }
            }
        } else {
            // Before creating a new profile, check if this email/phone already belongs to another user
            let existingProfile: UserProfile | null = null;
            if (firebaseUser.email) {
                const emailLookup = await getDoc(doc(db, "user_lookup", "email_" + btoa(firebaseUser.email)));
                if (emailLookup.exists()) {
                    const existingUid = emailLookup.data().uid;
                    const existingSnap = await getDoc(doc(db, "users", existingUid));
                    if (existingSnap.exists()) {
                        existingProfile = existingSnap.data() as UserProfile;
                    }
                }
            }
            if (!existingProfile && firebaseUser.phoneNumber) {
                const phoneLookup = await getDoc(doc(db, "user_lookup", "phone_" + firebaseUser.phoneNumber));
                if (phoneLookup.exists()) {
                    const existingUid = phoneLookup.data().uid;
                    const existingSnap = await getDoc(doc(db, "users", existingUid));
                    if (existingSnap.exists()) {
                        existingProfile = existingSnap.data() as UserProfile;
                    }
                }
            }

            if (existingProfile) {
                // Email/phone already registered — use the existing profile, don't duplicate
                setUserProfile(existingProfile);
                return;
            }

            const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                phoneNumber: firebaseUser.phoneNumber,
                photoURL: firebaseUser.photoURL,
                bio: null, gender: null, dob: null, bloodGroup: null,
                emailVerified: firebaseUser.emailVerified,
                phoneVerified: !!firebaseUser.phoneNumber,
                role: "patient",
                createdAt: serverTimestamp(),
            };
            await setDoc(docRef, newProfile);
            // Create lookup entries for uniqueness checks
            if (firebaseUser.email) {
                await setDoc(doc(db, "user_lookup", "email_" + btoa(firebaseUser.email)), { uid: firebaseUser.uid, email: firebaseUser.email });
            }
            if (firebaseUser.phoneNumber) {
                await setDoc(doc(db, "user_lookup", "phone_" + firebaseUser.phoneNumber), { uid: firebaseUser.uid, phone: firebaseUser.phoneNumber });
            }
            setUserProfile(newProfile);
        }
        // Subscribe to real-time profile updates for admin role changes, etc.
        profileUnsubRef.current = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setUserProfile(snap.data() as UserProfile);
            }
        });
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                setUser(firebaseUser);
                if (firebaseUser) {
                    await fetchOrCreateProfile(firebaseUser);
                } else {
                    if (profileUnsubRef.current) { profileUnsubRef.current(); profileUnsubRef.current = null; }
                    setUserProfile(null);
                }
            } catch (error) {
                console.error("Auth hydration error:", error);
                // Even on error, we must let the app move past the loading state
                // otherwise the user is stuck with a white screen/spinner forever.
            } finally {
                setLoading(false);
            }
        });
        return () => {
            if (profileUnsubRef.current) { profileUnsubRef.current(); profileUnsubRef.current = null; }
            unsubscribe();
        };
    }, []);

    // ── Send OTP: dynamically import RecaptchaVerifier to avoid module-level crash ──
    const sendOtp = async (phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> => {
        // Destroy old verifier if it exists
        if (recaptchaVerifierRef.current) {
            try { recaptchaVerifierRef.current.clear(); } catch (_) {}
            recaptchaVerifierRef.current = null;
        }

        // Dynamic import so RecaptchaVerifier never runs at module parse time
        const { RecaptchaVerifier } = await import("firebase/auth");
        const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
            size: "invisible",
            callback: () => {},
        });
        recaptchaVerifierRef.current = verifier;

        return await signInWithPhoneNumber(auth, phoneNumber, verifier);
    };

    // ── Setup Phone Profile (called after OTP is verified) ──
    const setupPhoneProfile = async (name: string, email?: string, existingUser?: User): Promise<void> => {
        const firebaseUser = existingUser || auth.currentUser;
        if (!firebaseUser) throw new Error("No authenticated user found.");
        
        // Only update display name if provided
        if (name && name.trim()) {
            await firebaseUpdateProfile(firebaseUser, { displayName: name.trim() });
        }

        // Build/merge Firestore profile
        const profileData: Partial<UserProfile> = {
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber,
            phoneVerified: true,
            role: "patient",
        };

        if (name && name.trim()) profileData.displayName = name.trim();
        if (email) profileData.email = email;

        // Check if profile already exists
        const docRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            // New user — create full profile
            await setDoc(docRef, {
                ...profileData,
                displayName: name?.trim() || firebaseUser.displayName || "User",
                email: email || null,
                photoURL: null,
                bio: null, gender: null, dob: null, bloodGroup: null,
                emailVerified: false,
                createdAt: serverTimestamp(),
            });
        } else {
            // Existing user — just update phone verification
            await setDoc(docRef, profileData, { merge: true });
        }

        // Silently send email verification in background if email provided
        if (email) {
            if (!firebaseUser.email) {
                verifyBeforeUpdateEmail(firebaseUser, email, actionCodeSettings).catch(() => {});
            } else {
                sendEmailVerification(firebaseUser, actionCodeSettings).catch(() => {});
            }
        }
        
        await fetchOrCreateProfile(firebaseUser);
    };

    // ── Confirm OTP + create/update Firestore profile ──
    const confirmOtp = async (
        confirmationResult: ConfirmationResult,
        otp: string,
        name: string,
        email?: string
    ): Promise<void> => {
        const cred = await confirmationResult.confirm(otp);
        await setupPhoneProfile(name, email, cred.user);
    };

    // ── Email login (fallback) ──
    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    // ── Email register (fallback) ──
    const registerWithEmail = async (email: string, password: string, name: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await firebaseUpdateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user, actionCodeSettings);
        const profile: UserProfile = {
            uid: cred.user.uid, email: cred.user.email, displayName: name,
            phoneNumber: null, photoURL: null, bio: null, gender: null,
            dob: null, bloodGroup: null, emailVerified: false, phoneVerified: false,
            role: "patient", createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", cred.user.uid), profile, { merge: true });
        setUserProfile(profile);
    };

    const logout = async () => { await signOut(auth); setUserProfile(null); };
    const resetPassword = async (email: string) => { await sendPasswordResetEmail(auth, email); };

    const deleteAccount = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteUser(currentUser);
        setUserProfile(null);
    };

    const resendVerification = async (pendingEmail?: string) => {
        if (!auth.currentUser) throw new Error("Not authenticated");
        if (!auth.currentUser.email && pendingEmail) {
            await verifyBeforeUpdateEmail(auth.currentUser, pendingEmail, actionCodeSettings);
        } else {
            await sendEmailVerification(auth.currentUser, actionCodeSettings);
        }
    };

    const refreshUser = async () => {
        if (!auth.currentUser) return;
        await reload(auth.currentUser);
        setUser(auth.currentUser);
        await fetchOrCreateProfile(auth.currentUser);
    };

    const updateUserProfile = async (data: Partial<UserProfile>) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");
        const authUpdates: { displayName?: string; photoURL?: string } = {};
        if (data.displayName !== undefined) authUpdates.displayName = data.displayName ?? undefined;
        if (data.photoURL !== undefined) authUpdates.photoURL = data.photoURL ?? undefined;
        if (Object.keys(authUpdates).length > 0) await firebaseUpdateProfile(currentUser, authUpdates);
        await setDoc(doc(db, "users", currentUser.uid), data as Record<string, unknown>, { merge: true });
        setUserProfile(prev => prev ? { ...prev, ...data } : prev);
        await logUserAction(currentUser.uid, "PROFILE_UPDATED", "User updated metadata profile");
    };

    const updateUserEmail = async (newEmail: string, currentPassword: string) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not authenticated");
        await reload(currentUser);
        setUser(auth.currentUser);
        const freshEmail = currentUser.email;
        if (freshEmail) {
            const cred = EmailAuthProvider.credential(freshEmail, currentPassword);
            await reauthenticateWithCredential(currentUser, cred);
        }
        await verifyBeforeUpdateEmail(currentUser, newEmail);
        await setDoc(doc(db, "users", currentUser.uid), { pendingEmail: newEmail }, { merge: true });
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
        if (!currentUser) throw new Error("Not authenticated");
        if (!currentUser.email) throw new Error("Please link an email address first to set a password.");
        
        const userHasPassword = currentUser.providerData?.some(p => p?.providerId === 'password');
        
        if (userHasPassword) {
            if (!currentPassword) throw new Error("Current password is required.");
            const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
            await reauthenticateWithCredential(currentUser, credential);
        }
        
        await firebaseUpdatePassword(currentUser, newPassword);
        await reload(currentUser);
        setUser(auth.currentUser);
        
        await logUserAction(currentUser.uid, userHasPassword ? "PASSWORD_CHANGED" : "PASSWORD_CREATED", userHasPassword ? "User successfully changed password from settings" : "User created initial password");
    };

    const uploadProfilePhoto = async (file: File, onProgress?: (p: number) => void): Promise<string> => {
        if (!user) throw new Error("Not authenticated");
        const storageRef = ref(storage, `profile-photos/${user.uid}`);
        return new Promise((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, file);
            task.on("state_changed",
                (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                (error) => reject(error),
                async () => { const url = await getDownloadURL(task.snapshot.ref); resolve(url); }
            );
        });
    };

    const internalLogActivity = async (uid: string, type: string, oldValue: string, newValue: string, metadata: any = {}) => {
        try {
            const logRef = collection(db, "users", uid, "securityLogs");
            await addDoc(logRef, {
                type, oldValue, newValue,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent,
                ip: "Client-side (Approximate)",
                ...metadata
            });
        } catch (error) {
            console.error("Failed to persist security activity:", error);
        }
    };

    const logSecurityActivity = async (type: string, oldValue: string, newValue: string, metadata: any = {}) => {
        if (!auth.currentUser) return;
        await internalLogActivity(auth.currentUser.uid, type, oldValue, newValue, metadata);
    };

    const isFullyVerified = !!(userProfile?.emailVerified || userProfile?.phoneVerified);

    return (
        <AuthContext.Provider value={{
            user, userProfile, loading,
            isAdmin: userProfile?.role === "admin" || user?.email === "rohit.official36@gmail.com" || user?.email === "rohit.no18@gmail.com",
            isFullyVerified, hasPassword: user?.providerData?.some(p => p?.providerId === 'password') || false,
            sendOtp, confirmOtp, setupPhoneProfile,
            login, registerWithEmail, logout,
            resetPassword, deleteAccount,
            resendVerification, refreshUser,
            updateUserProfile, updateUserEmail, updateUserPassword, uploadProfilePhoto,
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
