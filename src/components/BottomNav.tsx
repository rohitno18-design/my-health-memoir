import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const navItems = [
    { path: "/dashboard", mIcon: "home", labelKey: "nav.home" },
    { path: "/patients", mIcon: "group", labelKey: "nav.family" },
    { path: "/documents", mIcon: "folder_managed", labelKey: "nav.docs" },
    { path: "/ai-chat", mIcon: "auto_awesome", labelKey: "nav.ai" },
];

const adminNavItems = [
    { path: "/admin", mIcon: "admin_panel_settings", labelKey: "nav.admin" },
];

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAdmin } = useAuth();
    const { t } = useTranslation();

    const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

    return (
        // Fixed at bottom, includes safe-area padding so the nav pill clears the iPhone home indicator
        <nav
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
            <div className="px-4 pb-3 pt-1 max-w-lg mx-auto">
                <div className="glass-morphism rounded-[2rem] p-2 px-3 flex items-center justify-between shadow-xl border border-white/60 bg-white/85 backdrop-blur-xl">
                    {items.map(({ path, mIcon, labelKey }) => {
                        const active =
                            location.pathname === path ||
                            (path === "/ai-chat" && location.pathname.startsWith("/ai-chat"));

                        return (
                            <button
                                key={path}
                                onClick={() => navigate(path)}
                                className={cn(
                                    "flex flex-col items-center justify-center flex-1 min-h-[56px] rounded-[1.25rem] transition-all duration-300 active:scale-95",
                                    active ? "bg-brand-gradient text-white shadow-glow-sm" : "text-slate-400 hover:text-brand-indigo hover:bg-indigo-50/50"
                                )}
                            >
                                <span className={cn("material-symbols-outlined text-[22px] mb-[2px] transition-transform", active && "fill-1 scale-110")}>{mIcon}</span>
                                <span className={cn("text-[10px] tracking-wide transition-all leading-none", active ? "font-bold" : "font-semibold")}>{t(labelKey)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
