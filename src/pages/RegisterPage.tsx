import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
    Heart, User, Mail, Loader2, AlertTriangle,
    ShieldCheck, ArrowRight, CheckCircle2, ChevronLeft,
} from "lucide-react";
import { type ConfirmationResult } from "firebase/auth";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useFeatureFlags } from "@/lib/featureFlags";

type Step = "phone" | "otp" | "profile";

export function RegisterPage() {
    const { flags, loaded: flagsLoaded } = useFeatureFlags();
    const { sendOtp, setupPhoneProfile } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [consent, setConsent] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown > 0) {
            const t = setTimeout(() => setCooldown(c => c - 1), 1000);
            return () => clearTimeout(t);
        }
    }, [cooldown]);

    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaContainerId = "recaptcha-container-register";

    // ── Step 1: Send OTP ──────────────────────────────────────────────────
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10) { setError("Please enter a valid phone number."); return; }
        setError(""); setLoading(true);
        try {
            const result = await sendOtp("+" + phone, recaptchaContainerId);
            setConfirmationResult(result);
            setCooldown(30);
            setStep("otp");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-phone-number") setError("Invalid phone number. Include country code.");
            else if (code === "auth/too-many-requests") setError("Too many attempts. Please try again later.");
            else setError("Failed to send OTP. Please try again.");
            console.error(err);
        } finally { setLoading(false); }
    };

    // ── Step 2: Verify OTP ────────────────────────────────────────────────
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmationResult) return;
        if (otp.length !== 6) { setError("Please enter the 6-digit OTP."); return; }
        setError(""); setLoading(true);
        try {
            await confirmationResult.confirm(otp);
            setStep("profile");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/invalid-verification-code") setError("Wrong OTP. Please check and try again.");
            else if (code === "auth/code-expired") setError("OTP expired. Please go back and resend.");
            else setError("Verification failed. Please try again.");
        } finally { setLoading(false); }
    };

    // ── Step 3: Save profile + optional email ─────────────────────────────
    const handleCompleteProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setError("Please enter your name."); return; }
        if (!consent) { setError("You must agree to the Terms of Service & Privacy Policy."); return; }
        if (!confirmationResult) return;
        setError(""); setLoading(true);
        try {
            await setupPhoneProfile(name.trim(), email || undefined);
            navigate("/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        } finally { setLoading(false); }
    };

    if (flagsLoaded && !flags.newRegistrationsEnabled) {
        return (
            <div className="min-h-screen soft-gradient-bg flex flex-col items-center justify-center px-6 py-12">
                <div className="w-full max-w-sm text-center space-y-6">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
                        <h2 className="text-lg font-bold text-amber-800">Registrations Temporarily Closed</h2>
                        <p className="text-sm text-amber-700 mt-2">New registrations are currently disabled. Please check back later.</p>
                    </div>
                    <Link to="/login" className="text-sm text-primary hover:underline">Back to Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen soft-gradient-bg flex flex-col items-center justify-center px-6 py-12">
            {/* Invisible reCAPTCHA anchor — must be in DOM */}
            <div id={recaptchaContainerId} />

            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
                        <Heart size={28} className="text-primary-foreground fill-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold">I M Smrti</h1>
                    <p className="text-muted-foreground text-sm mt-1">Your Universal Health OS</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {(["phone", "otp", "profile"] as Step[]).map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                                step === s ? "bg-primary text-white scale-110" :
                                (["phone", "otp", "profile"].indexOf(step) > i) ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                            }`}>
                                {(["phone", "otp", "profile"].indexOf(step) > i) ? <CheckCircle2 size={14} /> : i + 1}
                            </div>
                            {i < 2 && <div className={`w-8 h-0.5 ${(["phone", "otp", "profile"].indexOf(step) > i) ? "bg-emerald-500" : "bg-muted"}`} />}
                        </div>
                    ))}
                </div>

                <div className="glass-card rounded-[2rem] shadow-2xl border border-white/50 p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
                    <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
                            <AlertTriangle size={14} className="flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* ── STEP 1: Phone Number ── */}
                    {step === "phone" && (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div>
                                <h2 className="text-xl font-bold mb-1">Create Account</h2>
                                <p className="text-sm text-muted-foreground">Enter your mobile number to get started</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Mobile Number</label>
                                <PhoneInput
                                    country="in"
                                    value={phone}
                                    onChange={setPhone}
                                    inputStyle={{
                                        width: "100%", height: "48px", fontSize: "14px",
                                        borderRadius: "12px", border: "1px solid rgba(255,255,255,0.4)",
                                        background: "rgba(255,255,255,0.5)", fontWeight: 600,
                                    }}
                                    buttonStyle={{ borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.5)" }}
                                    containerStyle={{ width: "100%" }}
                                />
                            </div>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                                <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
                                We'll send a 6-digit OTP to verify your number. Standard SMS rates may apply.
                            </div>
                            <button type="submit" disabled={loading || phone.length < 10 || cooldown > 0}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                {loading ? "Sending OTP..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Send OTP"}
                            </button>
                        </form>
                    )}

                    {/* ── STEP 2: OTP Verification ── */}
                    {step === "otp" && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div>
                                <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                                    className="flex items-center gap-1 text-sm text-muted-foreground mb-3 hover:text-foreground transition-colors">
                                    <ChevronLeft size={16} /> Back
                                </button>
                                <h2 className="text-xl font-bold mb-1">Verify OTP</h2>
                                <p className="text-sm text-muted-foreground">
                                    Sent to <span className="font-bold text-foreground">+{phone}</span>
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">6-Digit OTP</label>
                                <input
                                    type="tel" value={otp} maxLength={6}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                    placeholder="• • • • • •"
                                    className="w-full py-4 px-4 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-2xl font-bold text-center tracking-[0.5em] text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    autoFocus
                                />
                            </div>
                            <button type="submit" disabled={loading || otp.length !== 6}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                {loading ? "Verifying..." : "Verify OTP"}
                            </button>
                            <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                                Didn't receive it? Resend OTP
                            </button>
                        </form>
                    )}

                    {/* ── STEP 3: Profile Setup ── */}
                    {step === "profile" && (
                        <form onSubmit={handleCompleteProfile} className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold mb-1">Almost Done! 🎉</h2>
                                <p className="text-sm text-muted-foreground">Phone verified. Tell us your name.</p>
                            </div>
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Full Name</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                        required placeholder="Rahul Sharma" autoFocus
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                            </div>
                            {/* Email (optional) */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">
                                    Email <span className="text-muted-foreground font-normal">(optional — for account recovery)</span>
                                </label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                                {email && (
                                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                        <ShieldCheck size={11} className="text-emerald-500" />
                                        A verification link will be sent silently in background
                                    </p>
                                )}
                            </div>
                            {/* Consent */}
                            <div className="flex items-start gap-2">
                                <input type="checkbox" id="consent-phone" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 flex-shrink-0" />
                                <label htmlFor="consent-phone" className="text-xs text-muted-foreground leading-tight">
                                    I agree to the <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>, <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and acknowledge the Medical Disclaimer.
                                </label>
                            </div>
                            <button type="submit" disabled={loading || !name.trim() || !consent}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {loading ? "Setting up..." : "Create Account →"}
                            </button>
                        </form>
                    )}

                    <p className="text-sm text-center mt-6 text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="text-primary font-bold hover:underline">Log In</Link>
                    </p>
                </div>
                {/* Firebase ReCaptcha Widget Container (Invisible) */}
                <div id={recaptchaContainerId}></div>
            </div>
        </div>
    );
}
