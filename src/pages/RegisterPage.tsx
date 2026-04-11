import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Mail, Lock, User, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { type ConfirmationResult } from "firebase/auth";
import { useTranslation } from "react-i18next";

export function RegisterPage() {
    const { registerWithEmail, sendPhoneOtp } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Tab: email or phone
    const [method, setMethod] = useState<"email" | "phone" | "otp">("email");
    const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);

    // Form states
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [consent, setConsent] = useState(false);

    // ── Email registration ──
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consent) { setError("You must agree to the Terms of Service & Privacy Policy."); return; }
        if (password.length < 6) { setError(t("auth.invalidPassword")); return; }
        setError(""); setLoading(true);
        try {
            await registerWithEmail(email, password, name);
            navigate("/dashboard");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/email-already-in-use") {
                setError(t("account.errEmailUsed"));
            } else if (code === "auth/invalid-email") {
                setError(t("auth.invalidEmail"));
            } else {
                setError(err instanceof Error ? err.message : t("auth.errorTitle"));
            }
        } finally { setLoading(false); }
    };

    // ── Phone registration: send OTP ──
    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consent) { setError("You must agree to the Terms of Service & Privacy Policy."); return; }
        if (!phone || phone.length < 10) { setError(t("auth.invalidPhone")); return; }
        setError(""); setLoading(true);
        try {
            const result = await sendPhoneOtp("+" + phone, "recaptcha-container");
            setConfirmResult(result);
            setMethod("otp");
        } catch (err: unknown) {
            console.error("Phone register error:", err);
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-phone-number") {
                setError(t("auth.invalidPhone"));
            } else {
                setError(t("auth.errorTitle") + ": " + (err instanceof Error ? err.message : "Failed to send code."));
            }
        } finally { setLoading(false); }
    };

    // ── Phone registration: verify OTP ──
    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmResult) return;
        setError(""); setLoading(true);
        try {
            await confirmResult.confirm(otp);
            // Phone user is now signed in (new or existing)
            navigate("/dashboard");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-verification-code") {
                setError(t("account.errInvalidCode"));
            } else {
                setError(t("auth.errorTitle"));
            }
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen soft-gradient-bg flex flex-col items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
                        <Heart size={28} className="text-primary-foreground fill-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold">{t("auth.registerTitle")}</h1>
                    <p className="text-muted-foreground text-sm mt-2">{t("auth.startJourney")}</p>
                </div>

                <div className="glass-card rounded-[2rem] shadow-2xl border border-white/50 p-6 sm:p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10 group-hover:bg-primary/20 transition-colors"></div>
                    <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10 group-hover:bg-emerald-500/20 transition-colors"></div>
                    <h2 className="text-xl font-bold mb-6 text-slate-800 relative z-10">{t("auth.registerTitle")}</h2>

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mb-4">
                            {error}
                        </div>
                    )}

                    <div id="recaptcha-container"></div>

                    {/* Tabs */}
                    {method !== "otp" && (
                        <div className="flex bg-muted/50 p-1 rounded-lg mb-6">
                            <button type="button"
                                onClick={() => { setMethod("email"); setError(""); }}
                                className={`flex-1 text-sm font-bold py-2 rounded-md transition-colors ${method === "email" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-800"}`}>
                                {t("auth.email")}
                            </button>
                            <button type="button"
                                onClick={() => { setMethod("phone"); setError(""); }}
                                className={`flex-1 text-sm font-bold py-2 rounded-md transition-colors ${method === "phone" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-800"}`}>
                                {t("auth.phone")}
                            </button>
                        </div>
                    )}

                    {/* Email Register */}
                    {method === "email" && (
                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.fullName")}</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type="text" value={name}
                                        onChange={(e) => setName(e.target.value)} required
                                        placeholder="Rahul Sharma"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm text-slate-800 font-semibold focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/30 transition-all shadow-inner placeholder:font-medium" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.email")}</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type="email" value={email}
                                        onChange={(e) => setEmail(e.target.value)} required
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm text-slate-800 font-semibold focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/30 transition-all shadow-inner placeholder:font-medium" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.password")}</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type={showPw ? "text" : "password"} value={password}
                                        onChange={(e) => setPassword(e.target.value)} required
                                        placeholder="Min. 6 characters"
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm text-slate-800 font-semibold focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/30 transition-all shadow-inner placeholder:font-medium" />
                                    <button type="button" onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 mt-4 mb-2">
                                <input type="checkbox" id="consent-email" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                                <label htmlFor="consent-email" className="text-xs text-muted-foreground leading-tight">
                                    I agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>, <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and acknowledge the Medical Disclaimer.
                                </label>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                {loading ? t("common.loading") : t("auth.registerBtn")}
                            </button>
                        </form>
                    )}

                    {/* Phone Register */}
                    {method === "phone" && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.phone")}</label>
                                <PhoneInput
                                    country={'in'} value={phone}
                                    onChange={p => setPhone(p)}
                                    inputClass="!w-full !py-2.5 !h-auto !text-sm !rounded-lg !border-input !bg-background focus:!border-primary focus:!ring-2 focus:!ring-ring"
                                    containerClass="!w-full"
                                    buttonClass="!rounded-l-lg !border-input !bg-muted/30"
                                />
                            </div>
                            <div className="flex items-start gap-2 mt-4 mb-2">
                                <input type="checkbox" id="consent-phone" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                                <label htmlFor="consent-phone" className="text-xs text-muted-foreground leading-tight">
                                    I agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>, <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and acknowledge the Medical Disclaimer.
                                </label>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                {loading ? t("common.loading") : t("auth.sendCode")}
                            </button>
                        </form>
                    )}

                    {/* OTP verification */}
                    {method === "otp" && (
                        <form onSubmit={handleOtpSubmit} className="space-y-4">
                            <div className="bg-muted/50 p-4 rounded-xl border border-border">
                                <p className="text-sm font-medium mb-1">{t("auth.verifyPhoneTitle")}</p>
                                <p className="text-xs text-muted-foreground">
                                    {t("auth.smsSent", { phone })}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">6-digit Code</label>
                                <input type="text" value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                    required placeholder="000000" maxLength={6}
                                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center tracking-widest text-lg font-semibold placeholder:font-normal placeholder:tracking-normal" />
                            </div>
                            <button type="submit" disabled={loading || otp.length < 6}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : t("auth.verifyRegister")}
                            </button>
                            <button type="button" onClick={() => { setMethod("phone"); setOtp(""); setError(""); }}
                                className="w-full text-center text-sm flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mt-2">
                                <ArrowLeft size={14} /> {t("common.back")}
                            </button>
                        </form>
                    )}

                    <p className="text-sm text-center mt-4 text-muted-foreground">
                        {t("auth.hasAccount")}{" "}
                        <Link to="/login" className="text-primary font-medium hover:underline">
                            {t("auth.loginTitle")}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
