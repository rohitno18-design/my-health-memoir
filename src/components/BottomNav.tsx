import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const navItems = [
    { path: "/dashboard", mIcon: "home", labelKey: "nav.home" },
    { path: "/vitals", mIcon: "health_metrics", labelKey: "nav.vitals" },
    { path: "/emergency", mIcon: "shield_alert", labelKey: "nav.emergency" },
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
        <nav className="fixed bottom-6 left-4 right-4 sm:left-6 sm:right-6 z-50 max-w-lg mx-auto">
            <div className="glass-card rounded-[2rem] p-2 px-3 flex items-center justify-between shadow-2xl shadow-primary/10 border border-white/60 bg-white/70 backdrop-blur-xl">
                {items.map(({ path, mIcon, labelKey }) => {
                    const active =
                        location.pathname === path ||
                        (path === "/ai-chat" && location.pathname.startsWith("/ai-chat"));

                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-14 rounded-[1.25rem] transition-all duration-300 active:scale-95",
                                active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:text-primary hover:bg-primary/5"
                            )}
                        >
                            <span className={cn("material-symbols-outlined text-[24px] mb-[2px] transition-transform", active && "fill-1 scale-110")}>{mIcon}</span>
                            <span className={cn("text-[10px] tracking-wide transition-all", active ? "font-bold" : "font-semibold")}>{t(labelKey)}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
