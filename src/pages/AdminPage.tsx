import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldCheck, Users, FileText, KeyRound, Globe, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AdminPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ users: 0, docs: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [usersSnap, docsSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(collection(db, "documents")),
                ]);
                setStats({ users: usersSnap.size, docs: docsSnap.size });
            } catch (err) {
                console.error("Failed to fetch admin stats:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = [
        { label: "Total Users", value: stats.users, icon: Users, color: "bg-blue-50 text-blue-600" },
        { label: "Documents", value: stats.docs, icon: FileText, color: "bg-violet-50 text-violet-600" },
    ];

    const modules = [
        {
            id: "users",
            title: "User Management",
            description: "Manage accounts, adjust roles, generate login links.",
            icon: Users,
            color: "text-blue-600 bg-blue-50",
            path: "/admin/users"
        },
        {
            id: "content",
            title: "Content & Toggles",
            description: "Edit dictionary, announcements, site policies.",
            icon: Globe,
            color: "text-emerald-600 bg-emerald-50",
            path: "/admin/content"
        },
        {
            id: "settings",
            title: "System & AI",
            description: "Feature flags, API metrics, and Gemini tuning.",
            icon: Sparkles,
            color: "text-amber-600 bg-amber-50",
            path: "/admin/settings"
        }
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="py-6 space-y-6 pb-24 px-4 overflow-hidden">
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 mb-2">
                    <ShieldCheck size={28} className="text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
                </div>
                <p className="text-sm text-muted-foreground">Manage users, content, and system configuration.</p>
            </div>

            {/* Top Level Stats */}
            <div className="grid grid-cols-2 gap-4">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-card border border-border/50 shadow-sm rounded-2xl p-4 text-center">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 ${color}`}>
                            <Icon size={20} />
                        </div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{label}</p>
                    </div>
                ))}
            </div>

            {/* Modules */}
            <div className="space-y-4 pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground ml-1">Modules</h2>
                
                <div className="grid gap-3">
                    {modules.map((mod) => (
                        <button
                            key={mod.id}
                            onClick={() => navigate(mod.path)}
                            className="bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all rounded-2xl p-4 flex items-center gap-4 text-left group"
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${mod.color}`}>
                                <mod.icon size={24} strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{mod.title}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <ArrowRight size={16} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl">
                 <div className="flex items-center gap-2 text-red-800 mb-2">
                     <KeyRound size={18} />
                     <h3 className="font-semibold text-sm">Security Notice</h3>
                 </div>
                 <p className="text-xs text-red-700/80 leading-relaxed">
                     You are accessing a designated high-privilege area. All actions within the Command Center are logged for compliance.
                 </p>
            </div>
        </div>
    );
}
