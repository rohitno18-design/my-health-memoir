import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
    { path: "/dashboard", mIcon: "home", label: "Home" },
    { path: "/patients", mIcon: "group", label: "Family" },
    { path: "/timeline", mIcon: "timeline", label: "Timeline" },
    { path: "/documents", mIcon: "folder_managed", label: "Docs" },
    { path: "/ai-chat", mIcon: "auto_awesome", label: "AI" },
];


const adminNavItems = [
    { path: "/admin", mIcon: "admin_panel_settings", label: "Admin" },
];

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAdmin } = useAuth();

    const items = isAdmin ? [...navItems, ...adminNavItems] : navItems;

    return (
        <nav className="fixed bottom-6 left-6 right-6 z-50 max-w-lg mx-auto">
            <div className="glass-card rounded-[2rem] p-2 px-3 flex items-center justify-between shadow-2xl shadow-primary/10 border border-white/60">
                {items.map(({ path, mIcon, label }) => {
                    const active =
                        location.pathname === path ||
                        (path === "/profile" && location.pathname === "/patients") ||
                        (path === "/ai-chat" && location.pathname.startsWith("/ai-chat"));

                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className={cn(
                                "flex flex-col items-center justify-center w-[4.5rem] h-14 rounded-[1.25rem] transition-all duration-300 active:scale-95",
                                active ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:text-primary hover:bg-primary/5"
                            )}
                        >
                            <span className={cn("material-symbols-outlined text-[24px] mb-[2px] transition-transform", active && "fill-1 scale-110")}>{mIcon}</span>
                            <span className={cn("text-[10px] tracking-wide transition-all", active ? "font-bold" : "font-semibold")}>{label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
