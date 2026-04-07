import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Plus, MessageSquare, Clock, Trash2, Edit2, CheckCircle2, Circle, X } from "lucide-react";
import type { Chat } from "@/types/chat";
import { useTranslation } from "react-i18next";

function formatRelativeTime(timestamp: unknown, t: any): string {
    if (!timestamp) return "";
    const date =
        typeof (timestamp as { toDate?: () => Date }).toDate === "function"
            ? (timestamp as { toDate: () => Date }).toDate()
            : new Date(timestamp as string);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t("aiChatList.timeJustNow");
    if (minutes < 60) return t("aiChatList.timeMinsAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("aiChatList.timeHoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("aiChatList.timeDaysAgo", { count: days });
    return date.toLocaleDateString(t("common.localeCode"), { day: "numeric", month: "short", year: "numeric" });
}

export function ChatListPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection & Management State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "users", user.uid, "chats"),
            orderBy("updatedAt", "desc")
        );
        const unsub = onSnapshot(q, (snap) => {
            setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chat)));
            setLoading(false);
        });
        return unsub;
    }, [user]);

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleConfirmDelete = async (chatId: string) => {
        if (!user) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "users", user.uid, "chats", chatId));
            setConfirmingDeleteId(null);
        } catch (err) {
            console.error("Delete error:", err);
            alert("Failed to delete chat.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDelete = async () => {
        if (!user || selectedIds.size === 0) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, "users", user.uid, "chats", id));
            });
            await batch.commit();
            setIsSelectionMode(false);
            setSelectedIds(new Set());
        } catch (err) {
            console.error("Bulk delete error:", err);
            alert("Failed to delete chats.");
        } finally {
            setIsDeleting(false);
        }
    };

    const startRename = (e: React.MouseEvent, chat: Chat) => {
        e.stopPropagation();
        setRenamingChatId(chat.id);
        setNewTitle(chat.title || t("aiChatList.untitled"));
    };

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !renamingChatId || !newTitle.trim()) return;
        try {
            await updateDoc(doc(db, "users", user.uid, "chats", renamingChatId), {
                title: newTitle.trim(),
                updatedAt: new Date()
            });
            setRenamingChatId(null);
        } catch (err) {
            console.error("Rename error:", err);
            alert("Failed to rename chat.");
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8.5rem)] w-full max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute inset-0 soft-gradient-bg -z-10 pointer-events-none" />

            {/* Header */}
            <div className="px-5 pt-6 pb-4 flex items-center justify-between relative z-50 bg-white/40 backdrop-blur-md">
                <div>
                    <h1 className="text-xl font-bold">{t("aiChatList.title")}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isSelectionMode ? `${selectedIds.size} ${t("aiChatList.selected")}` : t("aiChatList.subtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {chats.length > 0 && (
                        <button
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                setSelectedIds(new Set());
                            }}
                            className={`p-2 rounded-xl transition-all ${isSelectionMode ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
                        >
                            {isSelectionMode ? <X size={18} /> : <CheckCircle2 size={18} />}
                        </button>
                    )}
                    {!isSelectionMode && (
                        <button
                            onClick={() => navigate("/ai-chat/new")}
                            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-2xl text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                        >
                            <Plus size={15} />
                            {t("aiChatList.new")}
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions Menu (Now at the top) */}
            {isSelectionMode && selectedIds.size > 0 && (
                <div className="px-5 mb-2 animate-in slide-in-from-top-4 fade-in duration-300 z-40">
                    <div className="glass-card rounded-[1.5rem] p-3 shadow-lg border border-primary/20 bg-white/80 backdrop-blur-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 ml-2">
                            {selectedIds.size} {selectedIds.size !== 1 ? t("aiChatList.chatsSelected") : t("aiChatList.selected")}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                {t("aiChatList.deselectAll")}
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-md shadow-red-100 hover:bg-red-600 transition-all active:scale-95"
                            >
                                <Trash2 size={12} />
                                {t("aiChatList.deleteSelected")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-5 space-y-2.5 pb-24 custom-scrollbar relative">
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {isDeleting && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
                        <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-slate-700">
                            <Trash2 size={20} className="animate-pulse text-red-500" />
                            {t("aiChatList.processing")}
                        </div>
                    </div>
                )}

                {!loading && chats.length === 0 && (
                    <div className="text-center p-10 glass-card rounded-[2rem] border border-white/40 shadow-sm mt-8">
                        <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                            <Bot size={28} className="text-violet-600" />
                        </div>
                        <p className="text-sm font-semibold">{t("aiChatList.noChats")}</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-5 max-w-xs mx-auto leading-relaxed">
                            {t("aiChatList.noChatsDesc")}
                        </p>
                        <button
                            onClick={() => navigate("/ai-chat/new")}
                            className="bg-primary text-primary-foreground px-5 py-2 rounded-2xl text-sm font-semibold hover:bg-primary/90 transition-all"
                        >
                            {t("aiChatList.startNew")}
                        </button>
                    </div>
                )}

                {chats.map((chat) => (
                    <div
                        key={chat.id}
                        className={`group relative overflow-hidden transition-all duration-200 ${isSelectionMode ? "cursor-pointer" : ""}`}
                        onClick={() => isSelectionMode ? toggleSelection(chat.id) : navigate(`/ai-chat/${chat.id}`)}
                    >
                        <div className={`w-full glass-card rounded-[1.5rem] border px-5 py-4 flex items-center gap-4 transition-all ${selectedIds.has(chat.id) ? "border-primary bg-primary/5 shadow-md" : "border-white/40 hover:shadow-md"}`}>
                            {isSelectionMode && (
                                <div className={`flex-shrink-0 transition-all ${selectedIds.has(chat.id) ? "text-primary scale-110" : "text-slate-300"}`}>
                                    {selectedIds.has(chat.id) ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </div>
                            )}
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                                <MessageSquare size={18} className="text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                {renamingChatId === chat.id ? (
                                    <form onSubmit={handleRename} onClick={e => e.stopPropagation()} className="flex items-center gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newTitle}
                                            onChange={e => setNewTitle(e.target.value)}
                                            onBlur={() => setRenamingChatId(null)}
                                            className="w-full bg-white border border-primary px-2 py-1 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </form>
                                ) : (
                                    <p className="font-semibold text-sm truncate">{chat.title || t("aiChatList.untitled")}</p>
                                )}
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                    <Clock size={11} />
                                    <span>{formatRelativeTime(chat.updatedAt, t)}</span>
                                    {chat.messageCount > 0 && <span className="ml-1 text-slate-400">· {chat.messageCount} {t("aiChatList.msg")}</span>}
                                </div>
                            </div>
                            
                            {!isSelectionMode && renamingChatId !== chat.id && (
                                <div className="flex items-center gap-1 transition-opacity">
                                    {confirmingDeleteId === chat.id ? (
                                        <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }}
                                                className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200"
                                            >
                                                {t("aiChatList.cancel")}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleConfirmDelete(chat.id); }}
                                                className="px-3 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 shadow-sm"
                                            >
                                                {t("aiChatList.confirm")}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); startRename(e, chat); }}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                title={t("aiChatList.rename")}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(chat.id); }}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                                title={t("aiChatList.delete")}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {!isSelectionMode && confirmingDeleteId !== chat.id && (
                                <span className="material-symbols-outlined text-slate-300 text-[18px]">
                                    chevron_right
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

