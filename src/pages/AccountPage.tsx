import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
    Camera, User, Mail, Phone, Lock, ChevronRight,
    Check, Loader2, LogOut, Pencil, ShieldCheck,
    Calendar, Droplets, UserCircle, AlertTriangle, X,
    Bell, Share2, Sparkles, CheckCircle2, ArrowRight,
    RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    doc, updateDoc, collection, getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { type ConfirmationResult } from "firebase/auth";

interface UserSettings {
    notifAppointments: boolean;
    notifHealthTips: boolean;
    notifAIInsights: boolean;
    privacyShowProfile: boolean;
    privacyDataSharing: boolean;
}

type Section = "info" | "security" | "settings";

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 3500);
        return () => clearTimeout(t);
    }, [onDismiss]);
    return (
        <div className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium max-w-xs w-full",
            type === "success" ? "bg-green-600 text-white" : "bg-destructive text-white"
        )}>
            {type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span className="flex-1">{message}</span>
            <button onClick={onDismiss}><X size={14} /></button>
        </div>
    );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ photoURL, displayName, size = "lg", onClick }: {
    photoURL?: string | null;
    displayName?: string | null;
    size?: "sm" | "lg";
    onClick?: () => void;
}) {
    const dim = size === "lg" ? "w-24 h-24 text-3xl" : "w-10 h-10 text-base";
    if (photoURL) {
        return (
            <img
                src={photoURL}
                alt={displayName ?? "User"}
                onClick={onClick}
                className={cn("rounded-full object-cover cursor-pointer ring-4 ring-primary/20", dim)}
            />
        );
    }
    return (
        <div onClick={onClick} className={cn("rounded-full bg-primary/10 flex items-center justify-center cursor-pointer ring-4 ring-primary/20 font-bold text-primary", dim)}>
            {(displayName ?? "U")[0].toUpperCase()}
        </div>
    );
}

// ─── EditableField ────────────────────────────────────────────────────────────
function EditableField({
    label, value, icon: Icon, onSave, type = "text", placeholder,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    onSave: (v: string) => Promise<void>;
    type?: string;
    placeholder?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    // Keep local state in sync when the parent value changes (e.g. after successful save)
    useEffect(() => {
        if (!editing) setVal(value);
    }, [value, editing]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError("");
        try {
            await onSave(val);
            setEditing(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Save failed. Check your connection.";
            setSaveError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        setVal(value);
        setSaveError("");
    };

    return (
        <div className="py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    {editing ? (
                        <input
                            autoFocus
                            type={type}
                            value={val}
                            onChange={e => setVal(e.target.value)}
                            placeholder={placeholder}
                            className="w-full mt-0.5 text-sm bg-secondary rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    ) : (
                        <p className="text-sm font-medium truncate">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
                    )}
                </div>
                {editing ? (
                    <div className="flex gap-1 flex-shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <button onClick={() => { setEditing(true); setSaveError(""); }} className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil size={14} />
                    </button>
                )}
            </div>
            {saveError && (
                <div className="mt-1.5 ml-11 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle size={11} />
                    {saveError}
                </div>
            )}
        </div>
    );
}

// ─── GenderSelect ─────────────────────────────────────────────────────────────
function GenderSelect({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [local, setLocal] = useState(value);

    useEffect(() => { setLocal(value); }, [value]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        setLocal(v);
        setSaving(true); setError(""); setSaved(false);
        try {
            await onSave(v);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-3 py-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User size={15} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
                <p className="text-[11px] text-muted-foreground">Gender</p>
                <select
                    value={local}
                    onChange={handleChange}
                    disabled={saving}
                    className="mt-0.5 text-sm font-medium bg-transparent focus:outline-none w-full disabled:opacity-60"
                >
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
            </div>
            {saving && <Loader2 size={14} className="animate-spin text-muted-foreground flex-shrink-0" />}
            {saved && <Check size={14} className="text-green-600 flex-shrink-0" />}
        </div>
    );
}

// ─── ChangePasswordModal ──────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const { updateUserPassword, logSecurityActivity } = useAuth();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (next !== confirm) { setError("Passwords don't match."); return; }
        if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
        setError(""); setSaving(true);
        try {
            await updateUserPassword(current, next);
            await logSecurityActivity("PASSWORD_CHANGE", "••••••••", "Updated", { refreshed: true });
            setDone(true);
            setTimeout(onClose, 1500);
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setError("Current password is incorrect.");
            } else if (code === "auth/too-many-requests") {
                setError("Too many attempts. Please try again later.");
            } else {
                setError("Update failed. Please try again.");
            }
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold">Change Password</h2>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                {done ? (
                    <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                            <Check size={22} className="text-green-600" />
                        </div>
                        <p className="font-medium text-sm">Password updated successfully!</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2.5 flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
                        {[
                            { label: "Current password", val: current, set: setCurrent },
                            { label: "New password", val: next, set: setNext },
                            { label: "Confirm new password", val: confirm, set: setConfirm },
                        ].map(({ label, val, set }) => (
                            <div key={label}>
                                <label className="block text-xs font-medium mb-1">{label}</label>
                                <input type="password" value={val} onChange={e => set(e.target.value)} required
                                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            </div>
                        ))}
                        <button type="submit" disabled={saving}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Update Password
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── ChangeEmailModal ─────────────────────────────────────────────────────────
function ChangeEmailModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
    const { user, userProfile, updateUserEmail, logSecurityActivity, refreshUser } = useAuth();
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [refreshing, setRefreshing] = useState(true);

    // CRITICAL: Refresh auth state when modal opens to get the LATEST Auth email
    // If user verified a previous email change in another tab, this picks it up
    useEffect(() => {
        (async () => {
            try {
                await refreshUser();
            } catch (e) {
                console.error("Refresh before email change failed:", e);
            } finally {
                setRefreshing(false);
            }
        })();
    }, []);

    // Auth email is always the source of truth — security warnings go here
    const authEmail = user?.email || "";
    // pendingEmail from Firestore (if any previous change is still unverified)
    const pendingEmail = (userProfile as any)?.pendingEmail || null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSaving(true);
        try {
            // updateUserEmail now force-reloads Auth internally too
            await updateUserEmail(newEmail, password);

            // After updateUserEmail, the Auth email might have been refreshed
            // so re-read it for the log message
            const currentAuthEmail = user?.email || authEmail;

            // Log that a change was requested
            await logSecurityActivity("EMAIL_CHANGE_REQUESTED", currentAuthEmail, newEmail, {
                status: "pending_verification",
                message: `Verification link sent to ${newEmail}. Security alert sent to ${currentAuthEmail}.`
            });

            setDone(true);
            onSuccess(`Verification link sent to ${newEmail}. Security alert sent to ${currentAuthEmail}.`);
        } catch (err: unknown) {
            console.error("Email update error:", err);
            const msg = err instanceof Error ? err.message : String(err);
            const code = (err as { code?: string })?.code;

            if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setError("Current password is incorrect.");
            } else if (code === "auth/email-already-in-use") {
                setError("That email is already used by another account.");
            } else if (code === "auth/requires-recent-login") {
                setError("Security timeout. Please log out and back in to change your email.");
            } else {
                setError(`Update failed: ${msg}`);
            }
        } finally { setSaving(false); }
    };

    if (refreshing) {
        return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl">
                    <div className="flex flex-col items-center gap-3 py-8">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Refreshing your account info…</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold">Change Email</h2>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                {done ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                            <Mail size={32} className="text-blue-600 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-lg">Verification Sent!</p>
                            <p className="text-sm text-muted-foreground px-4">
                                A verification link has been sent to <strong>{newEmail}</strong>.
                            </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mx-4">
                            <p className="text-xs text-blue-800 leading-relaxed">
                                Your email will <strong>not</strong> update until you click the link in <strong>{newEmail}</strong>.
                                The security warning was sent to <strong>{authEmail}</strong>.
                                After verifying, please refresh the page to see the change.
                            </p>
                        </div>
                        <button onClick={onClose} className="w-full mt-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                            Got it, I'll check my mail
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2.5 flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
                        {pendingEmail && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                                <p className="text-xs text-orange-800 font-semibold mb-1">⏳ Previous email change pending</p>
                                <p className="text-xs text-orange-700 leading-relaxed">
                                    You previously requested to change to <strong>{pendingEmail}</strong>, but it hasn't been verified yet.
                                    Your current login email is still <strong>{authEmail}</strong> — that's where the security warning will go.
                                </p>
                            </div>
                        )}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-800">⚠️ After changing your email, you will need to verify the new address. The security warning will be sent to your current login email below.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Current login email <span className="text-muted-foreground font-normal">(security warnings go here)</span></label>
                            <p className="text-sm text-muted-foreground px-3 py-2.5 rounded-xl border border-border bg-secondary">{authEmail}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">New email</label>
                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">Current password (to confirm)</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <button type="submit" disabled={saving}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Update Email & Send Verification
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── ChangePhoneModal ─────────────────────────────────────────────────────────
function ChangePhoneModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
    const { userProfile, linkPhoneToAccount, updateUserProfile, refreshUser, logSecurityActivity, getRecaptchaVerifier } = useAuth();
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"input" | "otp" | "done">("input");
    const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const recaptchaId = "recaptcha-phone-change";
    const oldPhone = userProfile?.phoneNumber || "";

    // Ensure reCAPTCHA is ready when modal opens
    useEffect(() => {
        const timer = setTimeout(() => {
            try { getRecaptchaVerifier(recaptchaId); } catch (e) { console.error("Recaptcha init error", e); }
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || phone.length < 10) { setError("Enter a valid phone number."); return; }
        setError(""); setLoading(true);
        try {
            const result = await linkPhoneToAccount("+" + phone, recaptchaId);
            setConfirmResult(result);
            setStep("otp");
        } catch (err: unknown) {
            console.error("Phone change OTP error:", err);
            const msg = err instanceof Error ? err.message : String(err);
            const code = (err as { code?: string })?.code;
            if (code === "auth/credential-already-in-use") {
                setError("This phone number is already linked to another account.");
            } else if (code === "auth/too-many-requests") {
                setError("Too many attempts. Please wait a few minutes.");
            } else if (code === "auth/invalid-phone-number") {
                setError("The phone number is invalid. Check the country code.");
            } else if (code === "auth/provider-already-linked") {
                // ... same as before but with better logging
                await updateUserProfile({ phoneNumber: "+" + phone, phoneVerified: true });
                await logSecurityActivity("PHONE_CHANGE", oldPhone, "+" + phone, {
                    notifiedOld: true,
                    message: `Security alert sent to ${oldPhone}`
                });
                await refreshUser();
                setStep("done");
                onSuccess(`Phone number updated! Alert sent to ${oldPhone}.`);
                setTimeout(onClose, 1500);
                return;
            } else {
                setError(`Failed to send code: ${msg}`);
            }
        } finally { setLoading(false); }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmResult) return;
        setError(""); setLoading(true);
        try {
            await confirmResult.confirm(otp);
            await updateUserProfile({ phoneNumber: "+" + phone, phoneVerified: true });
            await logSecurityActivity("PHONE_CHANGE", oldPhone, "+" + phone, {
                notifiedOld: true,
                message: `Security alert sent to ${oldPhone}`
            });
            await refreshUser();
            setStep("done");
            onSuccess(`Phone number updated & verified! Alert sent to ${oldPhone}.`);
            setTimeout(onClose, 1500);
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-verification-code") {
                setError("Invalid code. Please try again.");
            } else if (code === "auth/credential-already-in-use") {
                setError("This phone number is already linked to another account.");
            } else {
                setError("Verification failed. Try again.");
            }
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold">Change Phone Number</h2>
                    <button onClick={onClose}><X size={18} /></button>
                </div>

                <div id={recaptchaId}></div>

                {step === "done" ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                            <Check size={32} className="text-emerald-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-lg">Phone Number Updated!</p>
                            <p className="text-sm text-muted-foreground px-4">
                                Your login phone number has been updated to <strong>+{phone}</strong>.
                            </p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mx-4">
                            <p className="text-xs text-emerald-800 leading-relaxed">
                                A security warning was sent to your previous number <strong>{oldPhone}</strong>.
                            </p>
                        </div>
                        <button onClick={onClose} className="w-full mt-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                            Done
                        </button>
                    </div>
                ) : step === "input" ? (
                    <form onSubmit={handleSendOtp} className="space-y-3">
                        {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2.5 flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-800">⚠️ When you update your phone number, a security alert will be sent to your current number below.</p>
                        </div>
                        {userProfile?.phoneNumber && (
                            <div>
                                <label className="block text-xs font-medium mb-1">Current login phone <span className="text-muted-foreground font-normal">(security warnings go here)</span></label>
                                <p className="text-sm text-muted-foreground px-3 py-2.5 rounded-xl border border-border bg-secondary">{userProfile.phoneNumber}</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium mb-1">New phone number</label>
                            <PhoneInput
                                country={'in'} value={phone}
                                onChange={p => setPhone(p)}
                                inputClass="!w-full !py-2.5 !h-auto !text-sm !rounded-xl !border-input !bg-background"
                                containerClass="!w-full"
                                buttonClass="!rounded-l-xl !border-input !bg-muted/30"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">We'll send a verification code to this new number.</p>
                        <button type="submit" disabled={loading}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                            {loading ? "Sending code..." : "Send Verification Code"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                        {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2.5 flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
                        <div className="bg-muted/50 rounded-xl p-3 border border-border">
                            <p className="text-xs text-muted-foreground">Code sent to <strong>+{phone}</strong></p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">6-digit Code</label>
                            <input type="text" value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                required placeholder="000000" maxLength={6}
                                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm text-center tracking-widest text-lg font-semibold placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <button type="submit" disabled={loading || otp.length < 6}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : "Verify & Update Phone"}
                        </button>
                        <button type="button" onClick={() => { setStep("input"); setOtp(""); setError(""); }}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                            ← Change number
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0",
                checked ? "bg-primary" : "bg-muted"
            )}
        >
            <span className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                checked ? "translate-x-5" : "translate-x-0"
            )} />
        </button>
    );
}

// ─── SettingsSection ──────────────────────────────────────────────────────────
function SettingsSection({
    userId, initialSettings, navigate, logout, user,
}: {
    userId?: string;
    initialSettings?: UserSettings;
    navigate: (path: string) => void;
    logout: () => Promise<void>;
    user: import("firebase/auth").User | null;
}) {
    const defaults: UserSettings = {
        notifAppointments: true,
        notifHealthTips: true,
        notifAIInsights: false,
        privacyShowProfile: true,
        privacyDataSharing: false,
    };
    const [settings, setSettings] = useState<UserSettings>({ ...defaults, ...initialSettings });
    const [saving, setSaving] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const handleToggle = async (key: keyof UserSettings, value: boolean) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        if (!userId) return;
        setSaving(key);
        try {
            await updateDoc(doc(db, "users", userId), { settings: next });
        } catch (err: unknown) {
            // Revert on error
            setSettings(settings);
            setToast({ message: "Failed to save setting. Check Firestore rules.", type: "error" });
            console.error("Settings toggle error:", err);
        } finally {
            setSaving(null);
        }
    };

    const notifToggles = [
        { key: "notifHealthTips" as const, icon: Sparkles, label: "Daily Health Tips", sub: "Personalised wellness recommendations", color: "bg-amber-50 text-amber-600" },
        { key: "notifAIInsights" as const, icon: Bell, label: "AI Insights", sub: "Updates when AI analyses your documents", color: "bg-violet-50 text-violet-600" },
    ];

    const privacyToggles = [
        { key: "privacyDataSharing" as const, icon: Share2, label: "Anonymous Data Sharing", sub: "Help improve health research (no PII)", color: "bg-rose-50 text-rose-600" },
    ];

    return (
        <div className="space-y-4">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Quick nav */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-3 pb-1">Quick Access</p>
                {[
                    { label: "Manage Patients", sub: "Add/view family members", path: "/patients", colorBg: "bg-violet-50", colorText: "text-violet-600" },
                    { label: "My Documents", sub: "Upload & view records", path: "/documents", colorBg: "bg-blue-50", colorText: "text-blue-600" },
                ].map(({ label, sub, path, colorBg, colorText }) => (
                    <button key={path} onClick={() => navigate(path)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors border-t border-border first:border-t-0">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", colorBg, colorText)}>
                            <ChevronRight size={17} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                    </button>
                ))}
            </div>

            {/* Notifications */}
            <div className="glass-card rounded-[1.5rem] shadow-sm border border-white/50 overflow-hidden divide-y divide-white/40 mx-5 mt-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-3 pb-1">Notifications</p>
                {notifToggles.map(({ key, icon: Icon, label, sub, color }) => (
                    <div key={key} className="flex items-center gap-3 p-4 border-t border-border first:border-t-0">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}>
                            <Icon size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
                        </div>
                        {saving === key
                            ? <Loader2 size={18} className="animate-spin text-muted-foreground flex-shrink-0" />
                            : <Toggle checked={settings[key]} onChange={v => handleToggle(key, v)} />
                        }
                    </div>
                ))}
            </div>

            {/* Privacy */}
            <div className="glass-card rounded-[1.5rem] shadow-sm border border-white/50 overflow-hidden divide-y divide-white/40 mx-5 mb-5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-3 pb-1">Privacy</p>
                {privacyToggles.map(({ key, icon: Icon, label, sub, color }) => (
                    <div key={key} className="flex items-center gap-3 p-4 border-t border-border first:border-t-0">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}>
                            <Icon size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
                        </div>
                        {saving === key
                            ? <Loader2 size={18} className="animate-spin text-muted-foreground flex-shrink-0" />
                            : <Toggle checked={settings[key]} onChange={v => handleToggle(key, v)} />
                        }
                    </div>
                ))}
            </div>

            {/* Account info */}
            <div className="glass-card rounded-[1.5rem] p-5 space-y-2 shadow-sm border border-white/50 mx-5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Account Info</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">UID</span><span className="font-mono text-xs text-muted-foreground">{user?.uid?.slice(0, 12)}…</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Email verified</span><span className={user?.emailVerified ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{user?.emailVerified ? "Verified ✓" : "Not verified"}</span></div>
            </div>

            {/* Sign out */}
            <button onClick={async () => { await logout(); navigate("/login"); }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-destructive/10 text-destructive rounded-2xl text-sm font-semibold hover:bg-destructive/20 transition-colors">
                <LogOut size={16} /> Sign Out
            </button>
        </div>
    );
}

// ─── AccountPage ──────────────────────────────────────────────────────────────
// ─── SecurityHistory ──────────────────────────────────────────────────────────
function SecurityHistory({ userId }: { userId: string }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            console.log("Fetching security logs for UID:", userId);
            // Just fetch logs. The main AccountPage component handles syncing on mount/visibility.
            const colRef = collection(db, "users", userId, "securityLogs");
            const snap = await getDocs(colRef);
            console.log(`Fetched ${snap.size} security logs for user ${userId}`);

            // 3. Sort manually in memory for now to avoid needing a composite index immediately
            const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const sorted = rawLogs.sort((a: any, b: any) => {
                const ta = a.timestamp?.seconds || 0;
                const tb = b.timestamp?.seconds || 0;
                return tb - ta;
            });
            setLogs(sorted);
        } catch (err) {
            console.error("Error fetching security logs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [userId]);

    if (loading) return <div className="p-4 flex justify-center"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>;

    // Don't return null, show at least a header if it's the security section
    if (logs.length === 0) {
        return (
            <div className="glass-card rounded-[1.5rem] p-5 space-y-3 shadow-sm border border-white/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
                            <ShieldCheck size={17} className="text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold">Recent Security Activity</p>
                    </div>
                    <button onClick={() => { setLoading(true); fetchLogs(); }} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                        <RefreshCw size={14} className={cn("text-muted-foreground", loading && "animate-spin")} />
                    </button>
                </div>
                <div className="text-center py-4">
                    <ShieldCheck size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No recent security activity</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Try refreshing if you recently made changes</p>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card rounded-[1.5rem] p-5 space-y-3 shadow-sm border border-white/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
                        <ShieldCheck size={17} className="text-slate-600" />
                    </div>
                    <p className="text-sm font-semibold">Recent Security Activity</p>
                </div>
                <button onClick={() => { setLoading(true); fetchLogs(); }} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                    <RefreshCw size={14} className={cn("text-muted-foreground", loading && "animate-spin")} />
                </button>
            </div>
            <div className="space-y-3 pt-1">
                {logs.map((log: any) => (
                    <div key={log.id} className="flex gap-3 pl-12 border-l-2 border-muted py-0.5">
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    {log.type.replace("_", " ")}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleDateString() : "Just now"}
                                </p>
                            </div>
                            <p className="text-xs mt-1 text-foreground">
                                Changed from <span className="font-mono text-muted-foreground">{log.oldValue}</span> to <span className="font-mono">{log.newValue}</span>
                            </p>
                            {log.notifiedOld && (
                                <p className="text-[10px] text-green-600 font-medium mt-1 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> {log.message}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── AccountPage ──────────────────────────────────────────────────────────────
export function AccountPage() {
    const {
        user, userProfile, logout, refreshUser,
        updateUserProfile, uploadProfilePhoto
    } = useAuth();
    const navigate = useNavigate();
    const [section, setSection] = useState<Section>("info");
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoProgress, setPhotoProgress] = useState(0);
    const [showPwModal, setShowPwModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // CRITICAL: Refresh user data on mount and whenever the tab becomes visible
    // This ensures we catch email verification completion from other tabs.
    useEffect(() => {
        const handleVisibilityAndRefresh = async () => {
            if (document.visibilityState === "visible" && user?.uid) {
                console.log("Tab visible: Refreshing user state for UID:", user.uid);
                await refreshUser().catch(err => console.error("Refresh error:", err));
            }
        };

        handleVisibilityAndRefresh(); // Initial on mount
        document.addEventListener("visibilitychange", handleVisibilityAndRefresh);
        return () => document.removeEventListener("visibilitychange", handleVisibilityAndRefresh);
    }, [user?.uid]); // Only depend on UID string, not the whole user object

    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type });
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset the file input so the same file can be selected again
        e.target.value = "";
        setPhotoUploading(true);
        setPhotoProgress(0);
        try {
            const url = await uploadProfilePhoto(file, setPhotoProgress);
            await updateUserProfile({ photoURL: url });
            showToast("Profile photo updated!", "success");
        } catch (err: unknown) {
            console.error("Photo upload error:", err);
            const code = (err as { code?: string })?.code;
            if (code === "storage/unauthorized") {
                showToast("Upload blocked by Firebase Storage rules. See settings.", "error");
            } else {
                showToast("Photo upload failed. Please try again.", "error");
            }
        } finally {
            setPhotoUploading(false);
            setPhotoProgress(0);
        }
    };

    const handleProfileSave = async (data: Parameters<typeof updateUserProfile>[0]) => {
        try {
            await updateUserProfile(data);
            showToast("Saved successfully!", "success");
        } catch (err: unknown) {
            console.error("Profile save error:", err);
            const code = (err as { code?: string })?.code;
            throw new Error(
                code === "permission-denied"
                    ? "Permission denied. Firestore rules may need updating."
                    : err instanceof Error
                        ? err.message
                        : "Save failed. Please try again."
            );
        }
    };

    const tabs: { id: Section; label: string }[] = [
        { id: "info", label: "Personal" },
        { id: "security", label: "Security" },
        { id: "settings", label: "Settings" },
    ];

    return (
        <div className="pb-6 w-full max-w-lg mx-auto overflow-x-hidden space-y-5">
            <div className="absolute top-0 left-0 right-0 h-[50vh] soft-gradient-bg -z-10 pointer-events-none"></div>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Profile Header */}
            <div className="glass-card rounded-[2rem] p-6 shadow-xl shadow-primary/10 mt-6 border border-white/40 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col items-center text-center gap-3">
                    <div className="relative">
                        <Avatar photoURL={userProfile?.photoURL} displayName={userProfile?.displayName} size="lg" onClick={() => fileRef.current?.click()} />
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={photoUploading}
                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md border-2 border-card disabled:opacity-70"
                        >
                            {photoUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </div>
                    {photoUploading && (
                        <div className="w-full space-y-1">
                            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${photoProgress}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">Uploading… {photoProgress}%</p>
                        </div>
                    )}
                    <div>
                        <h2 className="text-xl font-bold">{userProfile?.displayName ?? "User"}</h2>
                        <p className="text-sm text-muted-foreground">{user?.email || userProfile?.email}</p>
                        {(userProfile as any)?.pendingEmail && (
                            <p className="text-[10px] text-orange-600 mt-0.5">⏳ Pending change to {(userProfile as any).pendingEmail} — verify to complete</p>
                        )}
                        {userProfile?.role === "admin" && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block bg-primary/10 text-primary">
                                Admin
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white/40 backdrop-blur-md rounded-2xl p-1.5 gap-1 shadow-sm border border-white/50">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setSection(t.id)}
                        className={cn("flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-all",
                            section === t.id ? "bg-white shadow-md text-primary" : "text-slate-500 hover:text-slate-700 hover:bg-white/50")}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* PERSONAL INFO */}
            {section === "info" && (
                <div className="glass-card rounded-[1.5rem] p-5 space-y-1 shadow-sm border border-white/50">
                    <EditableField
                        label="Full Name"
                        icon={User}
                        value={userProfile?.displayName ?? ""}
                        onSave={v => handleProfileSave({ displayName: v })}
                    />
                    {/* Phone — opens secure change modal */}
                    <div className="py-3 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <Phone size={15} className="text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-muted-foreground">Phone Number</p>
                                <p className="text-sm font-medium truncate">
                                    {userProfile?.phoneNumber || <span className="text-muted-foreground italic">Not set</span>}
                                    {userProfile?.phoneVerified && (
                                        <span className="ml-2 text-xs text-green-600 font-normal">✓ Verified</span>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setShowPhoneModal(true)} className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                                <Pencil size={14} />
                            </button>
                        </div>
                    </div>
                    <EditableField
                        label="Bio"
                        icon={UserCircle}
                        value={userProfile?.bio ?? ""}
                        placeholder="Tell us a bit about yourself"
                        onSave={v => handleProfileSave({ bio: v })}
                    />
                    <EditableField
                        label="Date of Birth"
                        icon={Calendar}
                        value={userProfile?.dob ?? ""}
                        type="date"
                        onSave={v => handleProfileSave({ dob: v })}
                    />
                    <EditableField
                        label="Blood Group"
                        icon={Droplets}
                        value={userProfile?.bloodGroup ?? ""}
                        placeholder="e.g. O+"
                        onSave={v => handleProfileSave({ bloodGroup: v })}
                    />
                    <GenderSelect
                        value={userProfile?.gender ?? ""}
                        onSave={v => handleProfileSave({ gender: v })}
                    />
                </div>
            )}

            {/* SECURITY */}
            {section === "security" && (
                <div className="space-y-4">
                    <div className="glass-card rounded-[1.5rem] shadow-sm border border-white/50 overflow-hidden divide-y divide-white/40">
                        <button onClick={() => setShowEmailModal(true)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                <Mail size={17} className="text-blue-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold">Change Email</p>
                                <p className="text-xs text-muted-foreground truncate">{user?.email || userProfile?.email}</p>
                                {(userProfile as any)?.pendingEmail && (
                                    <p className="text-[10px] text-orange-600">⏳ Pending: {(userProfile as any).pendingEmail}</p>
                                )}
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </button>
                        <div className="h-px bg-border mx-4" />
                        <button onClick={() => setShowPhoneModal(true)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Phone size={17} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold">Change Phone Number</p>
                                <p className="text-xs text-muted-foreground truncate">{userProfile?.phoneNumber || "Not set"}</p>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </button>
                        <div className="h-px bg-border mx-4" />
                        <button onClick={() => setShowPwModal(true)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors">
                            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                                <Lock size={17} className="text-orange-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold">Change Password</p>
                                <p className="text-xs text-muted-foreground">••••••••</p>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </button>
                    </div>

                    {/* Verification Status Card */}
                    <div className="glass-card rounded-[1.5rem] p-5 space-y-3 shadow-sm border border-white/50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                                <ShieldCheck size={17} className="text-green-600" />
                            </div>
                            <p className="text-sm font-semibold">Verification Status</p>
                        </div>
                        <div className="space-y-2 ml-12">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Email</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${userProfile?.emailVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                    {userProfile?.emailVerified ? "Verified ✓" : "Not verified"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Phone</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${userProfile?.phoneVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                    {userProfile?.phoneVerified ? "Verified ✓" : "Not verified"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SECURITY LOGS */}
                    {user?.uid && <SecurityHistory userId={user.uid} />}
                </div>
            )}

            {/* SETTINGS */}
            {section === "settings" && (
                <SettingsSection
                    userId={user?.uid}
                    initialSettings={(userProfile as unknown as { settings?: UserSettings })?.settings}
                    navigate={navigate}
                    logout={logout}
                    user={user}
                />
            )}

            {/* Modals */}
            {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
            {showEmailModal && <ChangeEmailModal onClose={() => setShowEmailModal(false)} onSuccess={(msg) => showToast(msg, "success")} />}
            {showPhoneModal && <ChangePhoneModal onClose={() => setShowPhoneModal(false)} onSuccess={(msg) => showToast(msg, "success")} />}
        </div>
    );
}
