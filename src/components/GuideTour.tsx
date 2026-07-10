import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GuideCharacter } from "@/components/GuideCharacter";
import { ChevronRight, ChevronLeft, X } from "lucide-react";

interface GuideTourProps {
    runOverride?: boolean;
    onFinish?: () => void;
}

interface TourStep {
    target: string | null; // CSS selector, or null for a centered message
    titleKey: string;
    bodyKey: string;
}

// The guided journey. Targets that don't exist on screen are handled
// gracefully (shown centered), so the tour never breaks.
const STEPS: TourStep[] = [
    { target: null, titleKey: "tour.welcomeTitle", bodyKey: "tour.welcomeBody" },
    { target: ".tour-upload-btn", titleKey: "tour.uploadTitle", bodyKey: "tour.uploadBody" },
    { target: ".tour-documents", titleKey: "tour.docsTitle", bodyKey: "tour.docsBody" },
    { target: ".tour-family", titleKey: "tour.familyTitle", bodyKey: "tour.familyBody" },
    { target: ".tour-visit", titleKey: "tour.visitTitle", bodyKey: "tour.visitBody" },
    { target: ".tour-emergency", titleKey: "tour.emergencyTitle", bodyKey: "tour.emergencyBody" },
    { target: null, titleKey: "tour.doneTitle", bodyKey: "tour.doneBody" },
];

interface Rect { top: number; left: number; width: number; height: number; }

export default function GuideTour({ runOverride, onFinish }: GuideTourProps) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [run, setRun] = useState(false);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const bodyRef = useRef<HTMLParagraphElement>(null);

    // Decide whether to auto-run for first-time users
    useEffect(() => {
        if (runOverride) { setIndex(0); setRun(true); return; }
        if (!user) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists() && !snap.data().hasSeenTour) { setIndex(0); setRun(true); }
            } catch (e) { console.error("Tour status check failed:", e); }
        })();
    }, [user, runOverride]);

    const step = STEPS[index];

    // Locate + scroll to the current target; recompute on scroll/resize
    const measure = useCallback(() => {
        if (!step?.target) { setRect(null); return; }
        const el = document.querySelector(step.target) as HTMLElement | null;
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [step]);

    useEffect(() => {
        if (!run || !step) return;
        if (step.target) {
            const el = document.querySelector(step.target) as HTMLElement | null;
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        // small delay so scroll settles before measuring
        const id = setTimeout(measure, 320);
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            clearTimeout(id);
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [run, index, step, measure]);

    const finish = useCallback(async () => {
        setRun(false);
        setIndex(0);
        onFinish?.();
        if (user) {
            try { await updateDoc(doc(db, "users", user.uid), { hasSeenTour: true }); }
            catch (e) { console.error("Failed to save tour status:", e); }
        }
    }, [user, onFinish]);

    const next = () => (index >= STEPS.length - 1 ? finish() : setIndex(i => i + 1));
    const back = () => setIndex(i => Math.max(0, i - 1));

    if (!run || !step) return null;

    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const pad = 8;
    // Dock the guide card away from the highlighted element: if the target sits
    // low on screen, put the card up top; otherwise dock at the bottom.
    const dockTop = !!rect && rect.top > vh * 0.5;
    const isCentered = !rect;

    const spotlight = rect ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
    } : null;

    return createPortal(
        <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
            <style>{`
                @keyframes guide-in { from { opacity:0; transform: translateY(10px) scale(.98) } to { opacity:1; transform: none } }
                @keyframes guide-ring { 0%,100%{ box-shadow: 0 0 0 3px rgba(99,102,241,.9), 0 0 0 9999px rgba(15,23,42,.62) } 50%{ box-shadow: 0 0 0 6px rgba(99,102,241,.55), 0 0 0 9999px rgba(15,23,42,.62) } }
            `}</style>

            {/* Dim + spotlight. When centered, a plain scrim. */}
            {spotlight ? (
                <div
                    className="absolute rounded-2xl pointer-events-none transition-all duration-300"
                    style={{ ...spotlight, animation: "guide-ring 2s ease-in-out infinite" }}
                />
            ) : (
                <div className="absolute inset-0 bg-slate-900/65" />
            )}

            {/* Click-blocker so the tour drives the flow */}
            <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

            {/* Guide card */}
            <div
                className="absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm px-1"
                style={
                    isCentered
                        ? { top: "50%", transform: "translate(-50%,-50%)" }
                        : dockTop
                            ? { top: "calc(env(safe-area-inset-top, 0px) + 5rem)" }
                            : { bottom: "calc(env(safe-area-inset-bottom, 0px) + 7rem)" }
                }
            >
                <div className="relative" style={{ animation: "guide-in .35s ease-out" }}>
                    {/* Character sits above the bubble, overlapping it */}
                    <div className="flex justify-center mb-[-28px] relative z-10">
                        <GuideCharacter size={72} talking />
                    </div>

                    {/* Speech / talk-cloud */}
                    <div className="bg-white rounded-[1.75rem] shadow-2xl border border-slate-100 pt-9 px-5 pb-4">
                        <p className="text-center text-[11px] font-black uppercase tracking-widest text-brand-indigo mb-1">
                            {t("tour.guideName", "Smriti")}
                        </p>
                        <h3 className="text-center text-lg font-black text-slate-900 mb-1.5 leading-tight">
                            {t(step.titleKey)}
                        </h3>
                        <p ref={bodyRef} className="text-center text-sm text-slate-600 leading-relaxed mb-4">
                            {t(step.bodyKey)}
                        </p>

                        {/* progress dots */}
                        <div className="flex justify-center gap-1.5 mb-4">
                            {STEPS.map((_, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand-indigo" : "w-1.5 bg-slate-200"}`}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            {index > 0 ? (
                                <button onClick={back} className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center active:scale-95 transition-transform shrink-0" aria-label={t("tour.back", "Back")}>
                                    <ChevronLeft size={18} />
                                </button>
                            ) : null}
                            <button
                                onClick={next}
                                className="flex-1 h-11 rounded-xl btn-gradient text-white text-sm font-black flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                            >
                                {index >= STEPS.length - 1 ? t("tour.finish", "Let's start!") : t("tour.next", "Next")}
                                {index < STEPS.length - 1 && <ChevronRight size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Skip */}
                    <button onClick={finish} className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-slate-800/80 text-white flex items-center justify-center backdrop-blur-sm active:scale-95 z-20" aria-label={t("tour.skip", "Skip")}>
                        <X size={15} />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
