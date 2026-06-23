import { Outlet, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { UploadNotificationListener } from "./UploadNotificationListener";
import { GlobalAlarmListener } from "./GlobalAlarmListener";

const getValidEmail = (val: any) => {
    if (!val || typeof val !== 'string') return null;
    const t = val.trim();
    // Exclude dummy strings and ensure it looks like a real email
    if (!t || t === "null" || t === "undefined" || t.length < 5 || !t.includes("@") || t.includes("example.com")) return null;
    return t;
};

function VerificationBanner() {
    const { user, userProfile, resendVerification, refreshUser, hasPassword } = useAuth();
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const navigate = useNavigate();

    // Auto-refresh every 5 seconds to check for email verification
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(async () => {
            try { await refreshUser(); } catch (_) {}
        }, 5000);
        return () => clearInterval(interval);
    }, [user]);

    if (!userProfile || !user) return null;

    const emailStr = getValidEmail(userProfile?.email) || getValidEmail(user?.email);
    const pendingEmailStr = getValidEmail((userProfile as any)?.pendingEmail);
    
    const hasEmail = Boolean(emailStr) || Boolean(pendingEmailStr);
    const isEmailVerified = userProfile?.emailVerified || user?.emailVerified || false;

    // Fully secure: Has email, it's verified, and has a password
    if (hasEmail && isEmailVerified && hasPassword && !pendingEmailStr) return null;

    const handleResend = async () => {
        setSending(true);
        try {
            const emailToVerify = pendingEmailStr || emailStr || undefined;
            if (!emailToVerify) {
                console.error("No email to verify.");
                return;
            }
            await resendVerification(emailToVerify);
            setSent(true);
        } catch (error: any) {
            console.error("Failed to resend verification", error);
            if (error?.code === 'auth/requires-recent-login' || error?.message?.includes('recent-login')) {
                alert("For security reasons, please log out and log back in before resending the verification link to a new email address.");
            } else {
                alert("Failed to send verification link. Please try again later.");
            }
        } finally {
            setSending(false);
        }
    };

    // STEP 1: Add Email
    if (!hasEmail) {
        return (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-2">
                <div className="flex items-center gap-2 text-amber-800 font-medium leading-tight">
                    <AlertCircle size={16} className="shrink-0" />
                    <span><span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200/50 px-1.5 py-0.5 rounded mr-2">Step 1/3</span>Please add an email address to secure your account.</span>
                </div>
                <button
                    onClick={() => navigate('/account?action=email')}
                    className="text-xs font-bold bg-amber-600 text-white px-4 py-1.5 rounded-full hover:bg-amber-700 transition-colors shrink-0"
                >
                    Add Email
                </button>
            </div>
        );
    }

    // STEP 2: Verify Email
    if (!isEmailVerified || pendingEmailStr) {
        const emailToVerify = pendingEmailStr || emailStr;
        return (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-2">
                <div className="flex items-center gap-2 text-amber-800 font-medium leading-tight">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>
                        <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200/50 px-1.5 py-0.5 rounded mr-2">Step 2/3</span>
                        Please verify your email: <span className="font-bold">{emailToVerify}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => navigate('/account?action=email')}
                        className="text-xs font-bold text-amber-700 bg-amber-200/50 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors"
                    >
                        Change Email
                    </button>
                    {sent ? (
                        <span className="text-amber-600 font-semibold text-xs bg-amber-100 px-3 py-1.5 rounded-full">Link sent!</span>
                    ) : (
                        <button
                            onClick={handleResend}
                            disabled={sending}
                            className="text-xs font-bold bg-amber-600 text-white px-4 py-1.5 rounded-full hover:bg-amber-700 transition-colors flex items-center gap-2 disabled:opacity-70"
                        >
                            {sending ? <Loader2 size={12} className="animate-spin" /> : null}
                            Resend Link
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // STEP 3: Create Password
    if (!hasPassword) {
        return (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-2">
                <div className="flex items-center gap-2 text-amber-800 font-medium leading-tight">
                    <AlertCircle size={16} className="shrink-0" />
                    <span><span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200/50 px-1.5 py-0.5 rounded mr-2">Step 3/3</span>Create a password for your account.</span>
                </div>
                <button
                    onClick={() => navigate('/account?action=password')}
                    className="text-xs font-bold bg-amber-600 text-white px-4 py-1.5 rounded-full hover:bg-amber-700 transition-colors shrink-0"
                >
                    Create Password
                </button>
            </div>
        );
    }

    return null;
}

export function AppLayout() {
    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900 overflow-x-hidden w-full max-w-[100vw] flex flex-col">
            <GlobalAlarmListener />
            <UploadNotificationListener />
            <VerificationBanner />
            <Header />
            <main
                className="w-full max-w-lg mx-auto flex-1"
                style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}
            >
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
}
