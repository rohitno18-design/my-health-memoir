import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
    Heart, Phone, Mail, Lock, Eye, EyeOff, Loader2,
    AlertTriangle, ArrowRight, ShieldCheck, ChevronLeft,
} from "lucide-react";
import { type ConfirmationResult } from "firebase/auth";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

type LoginMethod = "phone" | "email";
type PhoneStep = "input" | "otp";

export function LoginPage() {
    const { sendOtp, confirmOtp, login, resetPassword } = useAuth();
    const navigate = useNavigate();

    const [method, setMethod] = useState<LoginMethod>("phone");
    const [phoneStep, setPhoneStep] = useState<PhoneStep>("input");

    // Phone states
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    // Email states
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const recaptchaContainerId = "recaptcha-container-login";

    // ── Phone: Send OTP ──────────────────────────────────────────────────
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10) { setError("Please enter a valid phone number."); return; }
        setError(""); setLoading(true);
        try {
            const result = await sendOtp("+" + phone, recaptchaContainerId);
            setConfirmationResult(result);
            setPhoneStep("otp");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-phone-number") setError("Invalid phone number.");
            else if (code === "auth/too-many-requests") setError("Too many attempts. Please try again later.");
            else setError("Failed to send OTP. Please try again.");
        } finally { setLoading(false); }
    };

    // ── Phone: Verify OTP ────────────────────────────────────────────────
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmationResult || otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
        setError(""); setLoading(true);
        try {
            // confirmOtp handles login + profile sync
            await confirmOtp(confirmationResult, otp, "");
            navigate("/dashboard");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-verification-code") setError("Wrong OTP. Please try again.");
            else if (code === "auth/code-expired") setError("OTP expired. Please resend.");
            else setError("Verification failed.");
        } finally { setLoading(false); }
    };

    // ── Email login ──────────────────────────────────────────────────────
    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            await login(email, password);
            navigate("/dashboard");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential")
                setError("Incorrect email or password.");
            else if (code === "auth/too-many-requests") setError("Too many attempts. Try again later.");
            else setError("Login failed. Please try again.");
        } finally { setLoading(false); }
    };

    // ── Password reset ───────────────────────────────────────────────────
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) { setError("Enter your email first."); return; }
        setError(""); setLoading(true);
        try {
            await resetPassword(email);
            setResetSent(true);
        } catch {
            setError("Failed to send reset email.");
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen soft-gradient-bg flex flex-col items-center justify-center px-6 py-12">
            <div id={recaptchaContainerId} />

            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
                        <Heart size={28} className="text-primary-foreground fill-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold">I M Smrti</h1>
                    <p className="text-muted-foreground text-sm mt-1">Welcome back</p>
                </div>

                <div className="glass-card rounded-[2rem] shadow-2xl border border-white/50 p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
                    <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

                    {/* Method toggle */}
                    <div className="flex bg-muted/50 p-1 rounded-2xl mb-6">
                        <button onClick={() => { setMethod("phone"); setError(""); setPhoneStep("input"); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${method === "phone" ? "bg-white shadow text-slate-900" : "text-muted-foreground"}`}>
                            <Phone size={15} /> Mobile OTP
                        </button>
                        <button onClick={() => { setMethod("email"); setError(""); setResetMode(false); setResetSent(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${method === "email" ? "bg-white shadow text-slate-900" : "text-muted-foreground"}`}>
                            <Mail size={15} /> Email
                        </button>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
                            <AlertTriangle size={14} className="flex-shrink-0" /> {error}
                        </div>
                    )}

                    {/* ── PHONE: Enter number ── */}
                    {method === "phone" && phoneStep === "input" && (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div>
                                <h2 className="text-lg font-bold mb-1">Log In with OTP</h2>
                                <p className="text-sm text-muted-foreground">Enter your registered mobile number</p>
                            </div>
                            <PhoneInput
                                country="in" value={phone} onChange={setPhone}
                                inputStyle={{
                                    width: "100%", height: "48px", fontSize: "14px",
                                    borderRadius: "12px", border: "1px solid rgba(255,255,255,0.4)",
                                    background: "rgba(255,255,255,0.5)", fontWeight: 600,
                                }}
                                buttonStyle={{ borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.5)" }}
                                containerStyle={{ width: "100%" }}
                            />
                            <button type="submit" disabled={loading || phone.length < 10}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                {loading ? "Sending..." : "Send OTP"}
                            </button>
                        </form>
                    )}

                    {/* ── PHONE: Enter OTP ── */}
                    {method === "phone" && phoneStep === "otp" && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div>
                                <button type="button" onClick={() => { setPhoneStep("input"); setOtp(""); setError(""); }}
                                    className="flex items-center gap-1 text-sm text-muted-foreground mb-3 hover:text-foreground transition-colors">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                <h2 className="text-lg font-bold mb-1">Enter OTP</h2>
                                <p className="text-sm text-muted-foreground">Sent to <span className="font-bold text-foreground">+{phone}</span></p>
                            </div>
                            <input
                                type="tel" value={otp} maxLength={6}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                placeholder="• • • • • •"
                                className="w-full py-4 px-4 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-2xl font-bold text-center tracking-[0.5em] text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                autoFocus
                            />
                            <button type="submit" disabled={loading || otp.length !== 6}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                {loading ? "Verifying..." : "Verify & Log In"}
                            </button>
                            <button type="button" onClick={() => { setPhoneStep("input"); setOtp(""); setError(""); }}
                                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                                Resend OTP
                            </button>
                        </form>
                    )}

                    {/* ── EMAIL login ── */}
                    {method === "email" && !resetMode && (
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <h2 className="text-lg font-bold mb-1">Log In with Email</h2>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Email</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-white/40 bg-white/50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    />
                                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex justify-end mt-1">
                                    <button type="button" onClick={() => { setResetMode(true); setError(""); }} className="text-xs text-primary font-bold hover:underline">
                                        Forgot password?
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                                {loading ? "Logging in..." : "Log In"}
                            </button>
                        </form>
                    )}

                    {/* ── Password reset ── */}
                    {method === "email" && resetMode && (
                        <form onSubmit={handleReset} className="space-y-4">
                            <button type="button" onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}
                                className="flex items-center gap-1 text-sm text-muted-foreground mb-1 hover:text-foreground transition-colors">
                                <ChevronLeft size={16} /> Back
                            </button>
                            <h2 className="text-lg font-bold mb-1">Reset Password</h2>
                            {resetSent ? (
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm p-4 rounded-xl text-center">
                                    ✅ Reset link sent! Check your inbox.
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                            placeholder="you@example.com"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                        />
                                    </div>
                                    <button type="submit" disabled={loading || !email}
                                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                        {loading ? <Loader2 size={16} className="animate-spin" /> : "Send Reset Link"}
                                    </button>
                                </>
                            )}
                        </form>
                    )}

                    <p className="text-sm text-center mt-6 text-muted-foreground">
                        Don't have an account?{" "}
                        <Link to="/register" className="text-primary font-bold hover:underline">Sign Up</Link>
                    </p>
                </div>
                {/* Firebase ReCaptcha Widget Container (Invisible) */}
                <div id={recaptchaContainerId}></div>
            </div>
        </div>
    );
}
