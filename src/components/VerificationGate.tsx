import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    ShieldCheck, Mail, Phone, Loader2, CheckCircle2,
    RefreshCw, ArrowRight, Lock, Eye, EyeOff, Pencil
} from "lucide-react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { type ConfirmationResult } from "firebase/auth";

/**
 * VerificationGate wraps the entire protected app content.
 * If the user's email AND phone are both verified, children are rendered.
 * Otherwise, a full-screen prompt guides them to complete verification.
 */
export function VerificationGate({ children }: { children: React.ReactNode }) {
    const { user, userProfile, isFullyVerified } = useAuth();

    if (!user || !userProfile) return null;
    if (isFullyVerified) return <>{children}</>;

    return <VerificationScreen />;
}

// ══════════════════════════════════════════════════════════
// Main Verification Screen — shows BOTH sections at once
// ══════════════════════════════════════════════════════════
function VerificationScreen() {
    const { userProfile, refreshUser, logout } = useAuth();

    const emailDone = !!userProfile?.emailVerified;
    const phoneDone = !!userProfile?.phoneVerified;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center">
            {/* Top Bar for logout */}
            <div className="w-full flex items-center justify-end p-4 sticky top-0 z-10">
                <button onClick={logout} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-full hover:bg-slate-200/50">
                    Sign Out
                </button>
            </div>

            <main className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full pt-4">
                {/* Hero Illustration Area */}
                <div className="mb-8 relative">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                        <ShieldCheck size={48} strokeWidth={1.5} className="text-primary" />
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-slate-900">Complete Your Verification</h1>
                    <p className="text-slate-500 text-sm px-4">
                        We use multi-factor authentication to keep your sensitive health data private and secure.
                    </p>
                </div>

                {/* Verification Card */}
                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-8">
                    {/* Email Section */}
                    {emailDone ? (
                        <StatusDone icon="email" label="Email Address" detail={userProfile?.email || ""} detailSub="Primary verification method" />
                    ) : (
                        <EmailSection />
                    )}

                    {/* Phone Section */}
                    {phoneDone ? (
                        <StatusDone icon="phone" label="Phone Number" detail={userProfile?.phoneNumber || ""} detailSub="Secondary verification method" />
                    ) : (
                        <PhoneSection />
                    )}
                </div>

                {/* Both done but gate hasn't refreshed yet */}
                {emailDone && phoneDone && (
                    <div className="w-full mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
                        <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-800 mb-4">All verified!</p>
                        <button onClick={refreshUser}
                            className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all">
                            Continue to App
                        </button>
                    </div>
                )}

                <div className="mt-8 flex items-center gap-2 text-slate-400">
                    <Lock size={14} />
                    <span className="text-xs font-medium">End-to-end encrypted security</span>
                </div>
            </main>
        </div>
    );
}

// ────────────── Green "Done" row ──────────────
function StatusDone({ icon, label, detail, detailSub }: { icon: "email" | "phone"; label: string; detail: string; detailSub?: string }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    <CheckCircle2 size={12} strokeWidth={3} />
                    Done
                </span>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    {icon === "email" ? <Mail size={18} className="text-slate-400" /> : <Phone size={18} className="text-slate-400" />}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{detail}</p>
                    {detailSub && <p className="text-xs text-slate-400">{detailSub}</p>}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════
// EMAIL SECTION — handles 3 cases:
// 1. No email at all → show "Add Email" form
// 2. Email exists but not verified → show "Verify" + option to change
// ══════════════════════════════════════════════════════════
function EmailSection() {
    const { userProfile, linkEmailToAccount, updateUserEmail, resendVerification, refreshUser } = useAuth();
    const hasEmail = !!userProfile?.email;

    const [email, setEmail] = useState(userProfile?.email || "");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [editing, setEditing] = useState(!hasEmail); // Start in edit mode if no email
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);

    // Link a new email+password OR update existing unverified email
    const handleLinkEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
        setError(""); setLoading(true);
        try {
            if (hasEmail) {
                // If they already have an email, we should use the proper update function
                // which re-authenticates and sends the security alert to the OLD email.
                await updateUserEmail(email, password);
            } else {
                // If they signed up with phone and have NO email provider yet, we link it.
                await linkEmailToAccount(email, password);
            }
            setEditing(false);
            setResent(false);
            // Refresh to pick up any pendingEmail flags
            await refreshUser();
        } catch (err: unknown) {
            console.error("Email link/update error:", err);
            const code = (err as { code?: string })?.code;
            if (code === "auth/email-already-in-use") {
                setError("This email is already linked to another account.");
            } else if (code === "auth/invalid-email") {
                setError("Invalid email address.");
            } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setError("Incorrect password.");
            } else {
                setError("Error: " + (err instanceof Error ? err.message : "Failed to process email."));
            }
        } finally { setLoading(false); }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            await resendVerification();
            setResent(true);
        } catch { /* ignore */ }
        finally { setResending(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    <Loader2 size={12} className="animate-spin" />
                    Pending
                </span>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3">{error}</div>
            )}

            {/* Case 1: No email OR editing — show link form */}
            {editing ? (
                <form onSubmit={handleLinkEmail} className="space-y-4">
                    <div className="flex flex-col gap-4">
                        <div className="relative">
                            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)} required
                                placeholder="you@example.com"
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:font-normal placeholder:text-slate-400" />
                        </div>
                        <div className="relative">
                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type={showPw ? "text" : "password"} value={password}
                                onChange={(e) => setPassword(e.target.value)} required
                                placeholder={hasEmail ? "Current Password" : "Create Password (min. 6 chars)"}
                                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:font-normal placeholder:text-slate-400" />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {loading ? "Processing..." : "Link Email & Send Verification"}
                    </button>
                    {hasEmail && (
                        <button type="button" onClick={() => { setEditing(false); setError(""); }}
                            className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors py-2">
                            Cancel
                        </button>
                    )}
                </form>
            ) : (
                /* Case 2: Email exists, not verified — show verify prompt */
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500 mb-0.5">Current email</p>
                            <p className="text-sm font-semibold text-slate-800 truncate">{userProfile?.email}</p>
                        </div>
                        <button onClick={() => { setEditing(true); setEmail(userProfile?.email || ""); setError(""); }}
                            className="flex items-center justify-center size-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-primary hover:border-primary/50 transition-colors shrink-0 shadow-sm">
                            <Pencil size={14} />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 px-1 leading-relaxed">
                        Click the verification link we sent to your email, then press the button below.
                    </p>
                    <button onClick={refreshUser}
                        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <RefreshCw size={16} /> I've Verified My Email
                    </button>
                    {resending ? (
                        <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 size={12} className="animate-spin" /> Sending...
                        </p>
                    ) : resent ? (
                        <p className="text-center text-xs text-emerald-600 font-semibold font-medium">✓ Verification email resent!</p>
                    ) : (
                        <button onClick={handleResend} disabled={resending}
                            className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-2 py-2">
                            <RefreshCw size={14} /> Resend verification email
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════
// PHONE SECTION — handles 3 cases:
// 1. No phone → show "Add Phone" with phone input
// 2. Phone in profile but not verified → show it pre-filled, allow change, verify
// ══════════════════════════════════════════════════════════
function PhoneSection() {
    const { userProfile, linkPhoneToAccount, updateUserProfile, refreshUser } = useAuth();
    const existingPhone = userProfile?.phoneNumber || "";

    const [phone, setPhone] = useState(existingPhone.replace("+", ""));
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"input" | "otp">("input");
    const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || phone.length < 10) { setError("Enter a valid phone number."); return; }
        setError(""); setLoading(true);
        try {
            const result = await linkPhoneToAccount("+" + phone, "recaptcha-gate");
            setConfirmResult(result);
            setStep("otp");
        } catch (err: unknown) {
            console.error("Link phone error:", err);
            const code = (err as { code?: string })?.code;
            if (code === "auth/credential-already-in-use") {
                setError("This phone number is already linked to another account.");
            } else if (code === "auth/too-many-requests") {
                setError("Too many attempts. Please wait a few minutes and try again.");
            } else if (code === "auth/provider-already-linked") {
                // Phone provider already linked — just need to update profile
                await updateUserProfile({ phoneNumber: "+" + phone, phoneVerified: true });
                await refreshUser();
                return;
            } else {
                setError("Error: " + (err instanceof Error ? err.message : "Failed to send code."));
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
            await refreshUser();
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    Pending
                </span>
            </div>

            <div id="recaptcha-gate"></div>

            {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3">{error}</div>
            )}

            {step === "input" && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                    {existingPhone && (
                        <p className="text-xs text-slate-500 px-1 leading-relaxed">
                            Your current number: <strong className="text-slate-700">{existingPhone}</strong> — change it below or verify it.
                        </p>
                    )}
                    <div className="flex flex-col gap-4">
                        <div className="relative">
                            <PhoneInput
                                country={'in'} value={phone}
                                onChange={p => setPhone(p)}
                                inputClass="!w-full !py-3 !h-auto !text-sm !font-semibold !rounded-xl !border-slate-200 !bg-slate-50 focus:!ring-2 focus:!ring-primary focus:!border-transparent !transition-all"
                                containerClass="!w-full relative"
                                buttonClass="!rounded-l-xl !border-slate-200 !bg-slate-100/50"
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {loading ? "Sending code..." : "Send Verification Code"}
                    </button>
                </form>
            )}

            {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-center">
                        <p className="text-xs text-slate-500">Code sent to <strong className="text-slate-700">+{phone}</strong></p>
                    </div>
                    <div>
                        <input type="text" value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            required placeholder="000 000" maxLength={6}
                            className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-center tracking-widest text-2xl font-bold placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300" />
                    </div>
                    <button type="submit" disabled={loading || otp.length < 6}
                        className="w-full py-4 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify Phone"}
                    </button>
                    <button type="button" onClick={() => { setStep("input"); setOtp(""); setError(""); }}
                        className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors py-2">
                        ← Change number
                    </button>
                </form>
            )}
        </div>
    );
}
