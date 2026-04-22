import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LoginPage() {
    const { login, resetPassword } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [method, setMethod] = useState<"email" | "reset">("email");

    // Form states
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            await login(email, password);
            navigate("/dashboard");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (
                code === "auth/wrong-password" ||
                code === "auth/user-not-found" ||
                code === "auth/invalid-credential"
            ) {
                setError(t("auth.incorrectCreds"));
            } else if (code === "auth/too-many-requests") {
                setError(t("auth.tooManyRequests"));
            } else {
                setError((err instanceof Error ? err.message : null) ?? t("auth.errorTitle"));
            }
        } finally { setLoading(false); }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(""); setError(""); setLoading(true);
        if (!email) {
            setError(t("auth.enterEmailFirst") || "Please enter your email.");
            setLoading(false);
            return;
        }
        try {
            await resetPassword(email);
            setMessage("Password reset email sent. Check your inbox.");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/user-not-found") setError("No account found with this email.");
            else setError("Failed to send reset email.");
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen soft-gradient-bg flex flex-col items-center justify-center px-6 py-12">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
                        <Heart size={28} className="text-primary-foreground fill-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold">{t("header.title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("auth.subtitle")}</p>
                </div>

                <div className="glass-card rounded-[2rem] shadow-2xl border border-white/50 p-6 sm:p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10 group-hover:bg-primary/20 transition-colors"></div>
                    <div className="absolute bottom-0 left-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10 group-hover:bg-emerald-500/20 transition-colors"></div>
                    <h2 className="text-xl font-bold mb-6 text-slate-800 relative z-10">
                        {method === "reset" ? "Reset Password" : t("auth.loginTitle")}
                    </h2>

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
                            <AlertTriangle size={14} className="flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="bg-emerald-500/10 text-emerald-600 text-sm rounded-lg p-3 mb-4 flex items-center gap-2">
                            {message}
                        </div>
                    )}

                    {method === "email" && (
                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.email")}</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="email" value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm text-slate-800 font-semibold focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/30 transition-all shadow-inner placeholder:font-medium"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.password")}</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type={showPw ? "text" : "password"} value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required placeholder="••••••••"
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm text-slate-800 font-semibold focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/30 transition-all shadow-inner placeholder:font-medium"
                                    />
                                    <button type="button" onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex justify-end mt-1">
                                    <button type="button" onClick={() => { setMethod("reset"); setError(""); setMessage(""); }} className="text-xs text-primary font-bold hover:underline">Forgot password?</button>
                                </div>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                {loading ? t("common.loading") : t("auth.loginBtn")}
                            </button>
                        </form>
                    )}

                    {method === "reset" && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="bg-muted/50 p-4 rounded-xl border border-border">
                                <p className="text-sm font-medium mb-1">Reset Password</p>
                                <p className="text-xs text-muted-foreground">
                                    Enter your email to receive a password reset link.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">{t("auth.email")}</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="email" value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/40 bg-white/50 backdrop-blur-md text-sm text-slate-800 font-semibold focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/30 transition-all shadow-inner placeholder:font-medium"
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={loading || !email}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : "Send Reset Email"}
                            </button>
                            <button type="button" onClick={() => { setMethod("email"); setError(""); setMessage(""); }}
                                className="w-full text-center text-sm flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mt-2">
                                <ArrowLeft size={14} /> Back to Login
                            </button>
                        </form>
                    )}

                    <p className="text-sm text-center mt-6 text-muted-foreground">
                        {t("auth.noAccount")}{" "}
                        <Link to="/register" className="text-primary font-bold hover:underline">
                            {t("auth.registerTitle")}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
