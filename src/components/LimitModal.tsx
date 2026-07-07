import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Star, X, ArrowRight } from "lucide-react";

interface LimitModalProps {
    /** Headline, e.g. "Free plan limit reached" */
    title?: string;
    /** Explanation, e.g. "Free accounts can store up to 20 documents." */
    message: string;
    onClose: () => void;
}

/** Friendly upgrade prompt shown when a free-tier limit is hit. */
export function LimitModal({ title, message, onClose }: LimitModalProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div className="relative bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} aria-label={t("common.close", "Close")} className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <X size={16} className="text-slate-500" />
                </button>
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 mt-2">
                    <Star size={26} className="text-white fill-white" />
                </div>
                <h2 className="text-lg font-black text-slate-900 mb-2">
                    {title || t("limits.title", "Free plan limit reached")}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">{message}</p>
                <button
                    onClick={() => { onClose(); navigate("/premium"); }}
                    className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                    {t("limits.seePremium", "See Premium")} <ArrowRight size={15} />
                </button>
                <button onClick={onClose} className="w-full mt-2 py-2.5 text-slate-400 text-xs font-bold">
                    {t("limits.notNow", "Not now")}
                </button>
            </div>
        </div>
    );
}
