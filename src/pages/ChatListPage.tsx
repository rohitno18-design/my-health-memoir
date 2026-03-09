import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Plus, MessageSquare, Clock, Sparkles } from "lucide-react";
import type { Chat } from "@/types/chat";

function formatRelativeTime(timestamp: unknown): string {
    if (!timestamp) return "";
    const date =
        typeof (timestamp as { toDate?: () => Date }).toDate === "function"
            ? (timestamp as { toDate: () => Date }).toDate()
            : new Date(timestamp as string);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ChatListPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="flex flex-col h-[calc(100vh-8.5rem)] w-full max-w-2xl mx-auto relative">
            <div className="absolute inset-0 soft-gradient-bg -z-10 pointer-events-none" />

            {/* Header */}
            <div className="px-5 pt-6 pb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">AI Health Assistant</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Searches docs, links records, answers health questions
                    </p>
                </div>
                <button
                    onClick={() => navigate("/ai-chat/new")}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-2xl text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                >
                    <Plus size={15} />
                    New Chat
                </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-5 space-y-2.5 pb-4 custom-scrollbar">
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {!loading && chats.length === 0 && (
                    <div className="text-center p-10 glass-card rounded-[2rem] border border-white/40 shadow-sm mt-8">
                        <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                            <Bot size={28} className="text-violet-600" />
                        </div>
                        <p className="text-sm font-semibold">No chats yet</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-5 max-w-xs mx-auto leading-relaxed">
                            Ask me to find documents, link records to your timeline, or answer health questions.
                        </p>
                        <div className="flex flex-col gap-2 text-left mb-5 max-w-xs mx-auto">
                            {[
                                "Show all my blood sugar reports",
                                "Link my last 5 documents to events",
                                "What does HbA1c mean?",
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => navigate("/ai-chat/new", { state: { prefill: suggestion } })}
                                    className="flex items-center gap-2 text-xs text-left px-3 py-2 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors font-medium"
                                >
                                    <Sparkles size={12} className="flex-shrink-0" />
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => navigate("/ai-chat/new")}
                            className="bg-primary text-primary-foreground px-5 py-2 rounded-2xl text-sm font-semibold hover:bg-primary/90 transition-all"
                        >
                            Start New Chat
                        </button>
                    </div>
                )}

                {chats.map((chat) => (
                    <button
                        key={chat.id}
                        onClick={() => navigate(`/ai-chat/${chat.id}`)}
                        className="w-full glass-card rounded-[1.5rem] border border-white/40 px-5 py-4 flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98] text-left"
                    >
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <MessageSquare size={18} className="text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{chat.title || "Untitled Chat"}</p>
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                <Clock size={11} />
                                <span>{formatRelativeTime(chat.updatedAt)}</span>
                                {chat.messageCount > 0 && (
                                    <span className="ml-1 text-slate-400">
                                        · {chat.messageCount} message{chat.messageCount !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-300 text-[18px]">
                            chevron_right
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
