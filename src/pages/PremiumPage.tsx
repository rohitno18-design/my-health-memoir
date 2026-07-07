import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/lib/planLimits";
import {
    Star, Bot, FolderSync, Check, Stethoscope, Sparkles,
    FileDown, BellRing, Minus, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";

export function PremiumPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, userProfile, isPremium } = useAuth();
    const { limits } = usePlanLimits();
    const [notifying, setNotifying] = useState(false);
    const [notified, setNotified] = useState(!!(userProfile as any)?.premiumInterest);

    const notifyMe = async () => {
        if (!user || notifying || notified) return;
        setNotifying(true);
        try {
            await setDoc(doc(db, "users", user.uid), { premiumInterest: true, premiumInterestAt: new Date().toISOString() }, { merge: true });
            setNotified(true);
        } catch (e) {
            console.error("Failed to save premium interest:", e);
        } finally {
            setNotifying(false);
        }
    };

    const features = [
        {
            icon: <Stethoscope className="text-blue-600" size={24} />,
            title: t("premium.visitTitle", "Doctor Visit Briefings"),
            desc: t("premium.visitDesc", "Before every appointment, AI reads your family member's complete history and prepares a one-page briefing — medications, recent findings, vitals trends, and questions worth asking. Download as PDF and carry it in."),
            flagship: true,
        },
        {
            icon: <Bot className="text-purple-500" size={24} />,
            title: t("premium.chatTitle", "AI Medical Chat"),
            desc: t("premium.chatDesc", "Ask anything about your family's records — \"When was Papa's last HbA1c?\" — and get answers grounded in your own documents."),
        },
        {
            icon: <Sparkles className="text-amber-500" size={24} />,
            title: t("premium.analysisTitle", "AI Report Analysis"),
            desc: t("premium.analysisDesc", "Upload any lab report or prescription and get a plain-language summary you actually understand."),
        },
        {
            icon: <FolderSync className="text-emerald-500" size={24} />,
            title: t("premium.timelineTitle", "Automated Health Timeline"),
            desc: t("premium.timelineDesc", "AI reads your documents and plots key health events on each person's timeline automatically."),
        },
    ];

    const unlimited = t("premium.unlimited", "Unlimited");
    const perMonth = (n: number) => t("premium.perMonth", { count: n, defaultValue: "{{count}}/mo" });
    // [label, free-tier value, premium value] — false renders a dash, true a check
    const comparison: Array<[string, boolean | string, boolean | string]> = [
        [t("premium.cmpProfiles", "Family member profiles"), String(limits.freeMaxPatients), unlimited],
        [t("premium.cmpDocs", "Document storage"), String(limits.freeMaxDocuments), unlimited],
        [t("premium.cmpEmergency", "Emergency Pulse card"), true, true],
        [t("premium.cmpReminders", "Medicine & appointment reminders"), true, true],
        [t("premium.cmpVitals", "Vitals tracking"), true, true],
        [t("premium.cmpAnalysis", "AI report analysis"), perMonth(limits.freeDocSummariesPerMonth), unlimited],
        [t("premium.cmpBriefings", "Doctor visit briefings (PDF)"), perMonth(limits.freeVisitBriefingsPerMonth), unlimited],
        [t("premium.cmpChat", "AI medical chat"), false, true],
        [t("premium.cmpTimeline", "Automated timeline"), false, true],
    ];

    return (
        <div className="pb-32 w-full max-w-lg mx-auto overflow-x-hidden space-y-6 px-5 pt-5 relative">
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-amber-200/40 via-amber-100/10 to-transparent -z-10 pointer-events-none rounded-b-[4rem]"></div>

            {/* Header */}
            <div className="pt-6 pb-2 text-center">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 border border-amber-300">
                    <Star size={32} className="text-white fill-white" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">{t("premium.title", "I M Smrti Premium")}</h1>
                <p className="text-sm font-medium text-slate-500 mt-2 max-w-[300px] mx-auto">
                    {t("premium.subtitle", "The AI layer for the one who takes care of everyone.")}
                </p>
                {isPremium && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span className="text-xs font-black text-emerald-700">{t("premium.youHaveIt", "You have Premium")}</span>
                    </div>
                )}
            </div>

            {/* Flagship feature */}
            <button
                onClick={() => isPremium && navigate("/visit-summary")}
                className={`w-full text-left bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] text-white shadow-xl shadow-blue-600/20 relative overflow-hidden ${isPremium ? "active:scale-[0.98] transition-all cursor-pointer" : "cursor-default"}`}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full">{t("premium.flagship", "Flagship Feature")}</span>
                </div>
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shrink-0">
                        <Stethoscope size={24} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-black text-lg leading-tight mb-1.5">{features[0].title}</h3>
                        <p className="text-xs text-blue-100 leading-relaxed">{features[0].desc}</p>
                        {isPremium && (
                            <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-black text-white">
                                {t("premium.tryNow", "Try it now")} <ArrowRight size={14} />
                            </span>
                        )}
                    </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-blue-200 relative z-10">
                    <FileDown size={12} /> {t("premium.pdfNote", "One-page PDF · English or your language · from your own records")}
                </div>
            </button>

            {/* Other premium features */}
            <div className="space-y-3">
                {features.slice(1).map((f, i) => (
                    <div key={i} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-[1rem] bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                            {f.icon}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{f.title}</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Free vs Premium comparison */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{t("premium.whatYouGet", "What you get")}</p>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider text-center">{t("premium.free", "Free")}</p>
                    <p className="text-[11px] font-black text-amber-600 uppercase tracking-wider text-center flex items-center justify-center gap-1"><Star size={10} className="fill-amber-500 text-amber-500" />{t("premium.pro", "Pro")}</p>
                </div>
                {comparison.map(([label, free, pro]) => (
                    <div key={label} className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center px-5 py-3 border-b border-slate-50 last:border-0">
                        <p className="text-xs font-semibold text-slate-700 pr-2">{label}</p>
                        <div className="flex justify-center">
                            {typeof free === "string"
                                ? <span className="text-[11px] font-black text-slate-600">{free}</span>
                                : free ? <Check size={16} className="text-emerald-500" /> : <Minus size={16} className="text-slate-200" />}
                        </div>
                        <div className="flex justify-center">
                            {typeof pro === "string"
                                ? <span className="text-[10px] font-black text-amber-600">{pro}</span>
                                : pro ? <Check size={16} className="text-amber-500" /> : <Minus size={16} className="text-slate-200" />}
                        </div>
                    </div>
                ))}
            </div>

            {/* Coming soon / CTA */}
            {!isPremium && (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="flex items-center gap-2 mb-1">
                        <BellRing size={16} className="text-amber-400" />
                        <h3 className="font-bold text-lg">{t("premium.comingSoonTitle", "Premium is coming soon")}</h3>
                    </div>
                    <p className="text-sm text-slate-300 font-medium mb-6 leading-relaxed">
                        {t("premium.comingSoonDesc", "We're rolling out Premium in beta — it can't be purchased yet. Tap below and you'll be first in line when it opens.")}
                    </p>

                    <button
                        onClick={notifyMe}
                        disabled={notifying || notified}
                        className="w-full py-3.5 bg-amber-400 text-slate-900 font-black rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-90"
                    >
                        {notifying ? <Loader2 size={18} className="animate-spin" />
                            : notified ? <><CheckCircle2 size={18} /> {t("premium.notifiedOk", "You're on the list!")}</>
                            : <><BellRing size={18} /> {t("premium.notifyMe", "Notify me when it launches")}</>}
                    </button>
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="w-full mt-3 py-3 text-slate-300 text-sm font-bold rounded-xl hover:text-white transition-colors"
                    >
                        {t("premium.backHome", "Return to Home")}
                    </button>
                </div>
            )}

            {isPremium && (
                <button
                    onClick={() => navigate("/visit-summary")}
                    className="w-full py-4 btn-gradient text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                    <Stethoscope size={16} /> {t("premium.openVisitSummary", "Prepare a Doctor Visit Briefing")}
                </button>
            )}
        </div>
    );
}
