import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { Bell, Search, HelpCircle, Globe, ChevronDown } from "lucide-react";
import AppTour from "@/components/AppTour";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";

export function Header() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [runTour, setRunTour] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [langDropdownOpen, setLangDropdownOpen] = useState(false);

    const handleSearchClick = () => {
        setSearchOpen(true);
    };

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
        setLangDropdownOpen(false);
        // Set body direction for RTL languages like Urdu
        document.documentElement.dir = code === 'ur' ? 'rtl' : 'ltr';
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
                        className="size-10 min-w-[44px] min-h-[44px] rounded-full border-2 border-indigo-200 p-0.5 overflow-hidden active:scale-95 transition-all flex items-center justify-center"
                    >
                        {userProfile?.photoURL ? (
                            <img className="size-full rounded-full object-cover" alt="Profile" src={userProfile.photoURL} />
                        ) : (
                            <div className="size-full bg-indigo-50 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-brand-indigo">
                                    {(userProfile?.displayName?.trim() || userProfile?.email?.trim() || "U").charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <img src="/favicon-64.png" alt="Logo" className="size-5 rounded-lg" />
                            <h1 className="text-sm font-black tracking-tight text-slate-800">{t('header.title')}</h1>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="shrink-0 size-1.5 rounded-full bg-brand-indigo animate-pulse"></span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{t('header.liveSyncing')}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setRunTour(true)}
                        className="size-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors active:scale-95"
                        title="Start Tour"
                    >
                        <HelpCircle size={17} />
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                            className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors active:scale-95 font-semibold text-sm border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            title="Change Language"
                        >
                            <Globe size={15} />
                            <span className="hidden sm:inline-block tracking-wide text-xs">
                                {SUPPORTED_LANGUAGES.find(l => i18n.language.startsWith(l.code))?.nativeName || 'Language'}
                            </span>
                            <span className="sm:hidden tracking-wide text-xs uppercase font-bold">
                                {i18n.language.split('-')[0]}
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Language Dropdown Menu */}
                        {langDropdownOpen && (
                            <>
                                {/* Invisible backdrop to close dropdown when clicking outside */}
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setLangDropdownOpen(false)} 
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden">
                                    <div className="px-3 pb-2 mb-2 border-b border-slate-50">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('docs.chooseLanguage', 'Choose Language')}</p>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto px-1 scrollbar-hide">
                                        {SUPPORTED_LANGUAGES.map((lang) => {
                                            const isActive = i18n.language.startsWith(lang.code);
                                            return (
                                                <button
                                                    key={lang.code}
                                                    onClick={() => changeLanguage(lang.code)}
                                                    className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition-colors ${
                                                        isActive 
                                                            ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                                            : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-lg w-5 text-center">{lang.nativeName.charAt(0)}</span>
                                                        <span>{lang.nativeName}</span>
                                                    </span>
                                                    <span className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
                                                        {lang.code}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={handleSearchClick}
                        className="size-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors active:scale-95"
                    >
                        <Search size={17} />
                    </button>
                    <button
                        onClick={() => navigate("/notifications")}
                        className="size-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors active:scale-95 relative"
                    >
                        <Bell size={17} />
                        <span className="absolute top-1.5 right-1.5 size-2 bg-brand-purple rounded-full border-2 border-white"></span>
                    </button>
                </div>
            </div>
            <AppTour runOverride={runTour} onFinish={() => setRunTour(false)} />
            <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </header>
    );
}
