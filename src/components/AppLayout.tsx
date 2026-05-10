import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

function VerificationBanner() {
    const { user, userProfile, resendVerification, refreshUser } = useAuth();
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    // Check both Firestore profile AND Firebase Auth user for email verified status
    const isEmailVerified = userProfile?.emailVerified || user?.emailVerified || false;
    if (!userProfile || isEmailVerified) return null;

    // Auto-refresh every 5 seconds to check for email verification
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(async () => {
            try { await refreshUser(); } catch (_) {}
        }, 5000);
        return () => clearInterval(interval);
    }, [user]);

    const handleResend = async () => {
        setSending(true);
        try {
            await resendVerification(userProfile.email || undefined);
            setSent(true);
        } catch (error) {
            console.error("Failed to resend verification", error);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-800 font-medium">
                <AlertCircle size={16} className="shrink-0" />
                <span>Please verify your email address to fully secure your account.</span>
            </div>
            {sent ? (
                <span className="text-amber-600 font-semibold shrink-0 text-xs bg-amber-100 px-3 py-1.5 rounded-full">Verification link sent!</span>
            ) : (
                <button
                    onClick={handleResend}
                    disabled={sending}
                    className="text-xs font-bold bg-amber-600 text-white px-4 py-1.5 rounded-full hover:bg-amber-700 transition-colors shrink-0 flex items-center gap-2 disabled:opacity-70"
                >
                    {sending ? <Loader2 size={12} className="animate-spin" /> : null}
                    Resend Link
                </button>
            )}
        </div>
    );
}

export function AppLayout() {
    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900 overflow-x-hidden flex flex-col">
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
