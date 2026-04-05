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
        <header className="sticky top-0 z-[100] w-full px-4 py-3 flex items-center justify-between mx-auto md:max-w-lg bg-[#0b1326]/80 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/profile")} className="size-10 rounded-full border-2 border-primary/20 p-0.5 relative group overflow-hidden active:scale-95 transition-all">
                    {userProfile?.photoURL ? (
                        <img className="size-full rounded-full object-cover" alt="Profile" src={userProfile.photoURL} />
                    ) : (
                        <div className="size-full bg-emerald-500/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-emerald-500">
                                {(userProfile?.displayName ?? userProfile?.email ?? "U")[0].toUpperCase()}
                            </span>
                        </div>
                    )}
                </button>
                <div>
                    <h1 className="text-sm font-black font-lexend tracking-tight text-white">{t('header.title')}</h1>
                    <div className="flex items-center gap-1">
                        <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('header.liveSyncing')}</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={toggleLanguage}
                    className="size-10 flex items-center justify-center rounded-full bg-[#171f33] border border-white/5 shadow-sm text-slate-400 hover:text-white transition-colors active:scale-95 font-medium"
                    title="Toggle Language"
                >
                    {i18n.language.startsWith('en') ? 'अ' : 'A'}
                </button>
                <button onClick={() => navigate("/documents")} className="size-10 flex items-center justify-center rounded-full bg-[#171f33] border border-white/5 shadow-sm text-slate-400 hover:text-white transition-colors active:scale-95">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                </button>
                <button className="size-10 flex items-center justify-center rounded-full bg-[#171f33] border border-white/5 shadow-sm text-slate-400 hover:text-white transition-colors active:scale-95 relative">
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    <span className="absolute top-2.5 right-2.5 size-2 bg-emerald-500 rounded-full border border-[#0b1326]"></span>
                </button>
            </div>
        </header>
    );
}
