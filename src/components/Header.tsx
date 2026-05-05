import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Search } from "lucide-react";

export function Header() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('en') ? 'hi' : 'en';
        i18n.changeLanguage(newLang);
    };

    return (
        // sticky + pt-safe ensures header sits below the iOS status bar notch
        <header
            className="sticky top-0 z-[100] w-full bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
            <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/profile")}
                        // 44px min-size meets Apple HIG tap target requirement
                        className="size-10 min-w-[44px] min-h-[44px] rounded-full border-2 border-emerald-200 p-0.5 overflow-hidden active:scale-95 transition-all flex items-center justify-center"
                    >
                        {userProfile?.photoURL ? (
                            <img className="size-full rounded-full object-cover" alt="Profile" src={userProfile.photoURL} />
                        ) : (
                            <div className="size-full bg-emerald-50 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-emerald-600">
                                    {(userProfile?.displayName?.trim() || userProfile?.email?.trim() || "U").charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </button>
                    <div>
                        <h1 className="text-sm font-black tracking-tight text-slate-800">{t('header.title')}</h1>
                        <div className="flex items-center gap-1">
                            <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{t('header.liveSyncing')}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={toggleLanguage}
                        className="size-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors active:scale-95 font-bold text-sm"
                        title="Toggle Language"
                    >
                        {i18n.language.startsWith('en') ? 'अ' : 'A'}
                    </button>
                    <button
                        onClick={() => navigate("/documents")}
                        className="size-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors active:scale-95"
                    >
                        <Search size={17} />
                    </button>
                    <button
                        onClick={() => navigate("/notifications")}
                        className="size-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors active:scale-95 relative"
                    >
                        <Bell size={17} />
                        <span className="absolute top-1.5 right-1.5 size-2 bg-emerald-500 rounded-full border-2 border-white"></span>
                    </button>
                </div>
            </div>
        </header>
    );
}
