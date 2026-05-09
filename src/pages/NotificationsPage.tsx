import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
    Bell, 
    ArrowLeft, 
    Sparkles, 
    Clock, 
    ShieldCheck, 
    ChevronRight, 
    X,
    CheckCircle2,
    Loader2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, Timestamp } from "firebase/firestore";

interface Notification {
    id: string;
    type: "insight" | "reminder" | "security";
    title: string;
    description: string;
    time: string;
    isRead: boolean;
    actionLabel?: string;
    actionPath?: string;
    createdAt: Timestamp | null;
}

function formatRelativeTime(timestamp: Timestamp | null): string {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function NotificationsPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "users", user.uid, "notifications"),
            orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            const items: Notification[] = [];
            snap.forEach((d) => {
                const data = d.data();
                items.push({
                    id: d.id,
                    type: data.type || "insight",
                    title: data.title || "",
                    description: data.description || "",
                    time: formatRelativeTime(data.createdAt),
                    isRead: data.isRead ?? false,
                    actionLabel: data.actionLabel || undefined,
                    actionPath: data.actionPath || undefined,
                    createdAt: data.createdAt || null,
                });
            });
            setNotifications(items);
            setLoading(false);
        }, (err) => {
            console.error("Failed to load notifications:", err);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAsRead = async (id: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, "users", user.uid, "notifications", id), { isRead: true });
        } catch (e) {
            console.error("Failed to mark notification as read:", e);
        }
    };

    const markAllRead = async () => {
        if (!user || notifications.length === 0) return;
        try {
            const batch = writeBatch(db);
            notifications.forEach((n) => {
                if (!n.isRead) {
                    batch.update(doc(db, "users", user.uid, "notifications", n.id), { isRead: true });
                }
            });
            await batch.commit();
        } catch (e) {
            console.error("Failed to mark all as read:", e);
        }
    };

    const removeNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!user) return;
        try {
            await deleteDoc(doc(db, "users", user.uid, "notifications", id));
        } catch (err) {
            console.error("Failed to delete notification:", err);
        }
    };

    const filtered = notifications.filter(n => filter === "all" || !n.isRead);

    return (
        <div className="flex flex-col h-[calc(100vh-8.5rem)] w-full max-w-lg mx-auto relative overflow-hidden">
            <div className="absolute inset-0 soft-gradient-bg -z-10 pointer-events-none" />

            {/* Header */}
            <div className="px-5 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-xl bg-white/60 border border-white/40 flex items-center justify-center hover:bg-white/80 transition-all shadow-sm active:scale-95"
                        >
                            <ArrowLeft size={18} className="text-slate-600" />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight">{t("notifications.title")}</h1>
                    </div>
                    {unreadCount > 0 && (
                        <button 
                            onClick={markAllRead}
                            className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                        >
                            {t("notifications.markAllRead")}
                        </button>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 p-1 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
                    <button
                        onClick={() => setFilter("all")}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                            filter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        {t("notifications.filterAll")}
                    </button>
                    <button
                        onClick={() => setFilter("unread")}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2",
                            filter === "unread" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        {t("notifications.filterUnread")}
                        {unreadCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-6 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-4 text-slate-300">
                            <Bell size={32} />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">{t("notifications.emptyTitle")}</p>
                        <p className="text-xs text-slate-400 mt-1">{t("notifications.emptyDesc")}</p>
                    </div>
                ) : (
                    filtered.map((n) => (
                        <div
                            key={n.id}
                            onClick={() => {
                                markAsRead(n.id);
                                if (n.actionPath) navigate(n.actionPath);
                            }}
                            className={cn(
                                "group relative overflow-hidden glass-card rounded-[1.5rem] border p-4 transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.98]",
                                n.isRead ? "border-white/40 bg-white/40" : "border-violet-200 bg-violet-50/50"
                            )}
                        >
                            {!n.isRead && (
                                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                            )}
                            
                            <div className="flex gap-4">
                                <div className={cn(
                                    "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                                    n.type === "insight" ? "bg-amber-100 text-amber-600" :
                                    n.type === "reminder" ? "bg-blue-100 text-blue-600" :
                                    "bg-rose-100 text-rose-600"
                                )}>
                                    {n.type === "insight" ? <Sparkles size={20} /> :
                                     n.type === "reminder" ? <Clock size={20} /> :
                                     <ShieldCheck size={20} />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[13px] font-bold text-slate-800 tracking-tight leading-tight mb-1">
                                            {n.title}
                                        </p>
                                        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2 italic">
                                            {n.time}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-slate-500 leading-relaxed mb-3 pr-4">
                                        {n.description}
                                    </p>

                                    {n.actionLabel && (
                                        <div className="flex items-center gap-1 text-[11px] font-black text-primary uppercase tracking-wider">
                                            {n.actionLabel}
                                            <ChevronRight size={14} />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <button
                                onClick={(e) => removeNotification(e, n.id)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-200/50 text-slate-400 transition-all"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>
            
            {/* Footer Tip */}
            <div className="px-6 py-4 bg-white/20 backdrop-blur-md border-t border-white/40">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    {t("notifications.secureNote")}
                </div>
            </div>
        </div>
    );
}
