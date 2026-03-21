import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Header() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('en') ? 'hi' : 'en';
        i18n.changeLanguage(newLang);
    };

    return (
        <header className="sticky top-0 z-50 glass-card px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/profile")} className="size-10 rounded-full border-2 border-primary/20 p-0.5 relative group overflow-hidden active:scale-95 transition-all">
                    {userProfile?.photoURL ? (
                        <img className="size-full rounded-full object-cover" alt="Profile" src={userProfile.photoURL} />
                    ) : (
                        <div className="size-full bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                                {(userProfile?.displayName ?? userProfile?.email ?? "U")[0].toUpperCase()}
                            </span>
                        </div>
                    )}
                </button>
                <div>
                    <h1 className="text-sm font-bold tracking-tight text-slate-900">{t('header.title')}</h1>
                    <div className="flex items-center gap-1">
                        <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('header.liveSyncing')}</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={toggleLanguage}
                    className="size-10 flex items-center justify-center rounded-full bg-white/80 shadow-sm text-slate-600 hover:text-primary transition-colors active:scale-95 font-medium"
                    title="Toggle Language"
                >
                    {i18n.language.startsWith('en') ? 'अ' : 'A'}
                </button>
                <button onClick={() => navigate("/documents")} className="size-10 flex items-center justify-center rounded-full bg-white/80 shadow-sm text-slate-600 hover:text-primary transition-colors active:scale-95">
                    <span className="material-symbols-outlined text-[22px]">search</span>
                </button>
                <button className="size-10 flex items-center justify-center rounded-full bg-white/80 shadow-sm text-slate-600 hover:text-primary transition-colors active:scale-95 relative">
                    <span className="material-symbols-outlined text-[22px]">notifications</span>
                    <span className="absolute top-2.5 right-2.5 size-2 bg-primary rounded-full border-2 border-white"></span>
                </button>
            </div>
        </header>
    );
}
