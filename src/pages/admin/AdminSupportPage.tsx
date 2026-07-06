import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    collection, query, onSnapshot, addDoc, doc, serverTimestamp,
    orderBy, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    ArrowLeft, Inbox, Send, Loader2, CheckCircle2, Clock,
    RotateCcw, User as UserIcon, LifeBuoy,
} from "lucide-react";

interface Ticket {
    id: string;
    userId: string;
    userName: string;
    userContact: string;
    subject: string;
    status: "open" | "resolved";
    lastMessageAt: any;
    lastSender: "user" | "admin";
    unreadForAdmin: boolean;
    createdAt: any;
}

interface Message {
    id: string;
    sender: "user" | "admin";
    text: string;
    createdAt: any;
}

function fmtTime(ts: any): string {
    const d = ts?.toDate?.();
    if (!d) return "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " · " +
        d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function AdminSupportPage() {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"open" | "all">("open");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const activeTicket = tickets.find(t => t.id === activeId) || null;

    useEffect(() => {
        const q = query(collection(db, "support_tickets"));
        const unsub = onSnapshot(q, snap => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
            // Unread first, then open, then most recent
            items.sort((a, b) => {
                if (!!b.unreadForAdmin !== !!a.unreadForAdmin) return b.unreadForAdmin ? 1 : -1;
                if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
                return (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0);
            });
            setTickets(items);
            setLoading(false);
        }, (e) => { console.error("Support inbox load failed:", e); setLoading(false); });
        return unsub;
    }, []);

    useEffect(() => {
        if (!activeId) return;
        const q = query(collection(db, "support_tickets", activeId, "messages"), orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, snap => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
        });
        updateDoc(doc(db, "support_tickets", activeId), { unreadForAdmin: false }).catch(() => undefined);
        return unsub;
    }, [activeId]);

    const sendReply = useCallback(async () => {
        if (!activeTicket || !reply.trim() || sending) return;
        setSending(true);
        try {
            await addDoc(collection(db, "support_tickets", activeTicket.id, "messages"), {
                sender: "admin",
                text: reply.trim().slice(0, 3000),
                createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, "support_tickets", activeTicket.id), {
                lastMessageAt: serverTimestamp(),
                lastSender: "admin",
                unreadForUser: true,
                unreadForAdmin: false,
            });
            // In-app notification so the user actually sees the reply
            await addDoc(collection(db, "users", activeTicket.userId, "notifications"), {
                type: "insight",
                title: "Support replied to your request",
                description: activeTicket.subject,
                isRead: false,
                actionLabel: "View reply",
                actionPath: `/support?ticket=${activeTicket.id}`,
                createdAt: serverTimestamp(),
            }).catch((e) => console.warn("Notification write failed:", e));
            setReply("");
        } catch (e) {
            console.error("Reply failed:", e);
        } finally {
            setSending(false);
        }
    }, [activeTicket, reply, sending]);

    const setStatus = async (status: "open" | "resolved") => {
        if (!activeTicket) return;
        await updateDoc(doc(db, "support_tickets", activeTicket.id), { status });
    };

    const shown = filter === "open" ? tickets.filter(t => t.status === "open") : tickets;
    const openCount = tickets.filter(t => t.status === "open").length;
    const unreadCount = tickets.filter(t => t.unreadForAdmin).length;

    // ── Thread ───────────────────────────────────────────────────
    if (activeTicket) {
        return (
            <div className="py-6 pb-28 px-4 max-w-lg mx-auto w-full flex flex-col min-h-[calc(100dvh-6rem)]">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => setActiveId(null)} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm flex-shrink-0">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-bold tracking-tight truncate">{activeTicket.subject}</h1>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                            <UserIcon size={11} /> {activeTicket.userName || "Unknown"} · {activeTicket.userContact || activeTicket.userId.slice(0, 8)}
                        </p>
                    </div>
                    {activeTicket.status === "open" ? (
                        <button onClick={() => setStatus("resolved")} className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black flex items-center gap-1.5 flex-shrink-0">
                            <CheckCircle2 size={13} /> Resolve
                        </button>
                    ) : (
                        <button onClick={() => setStatus("open")} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-black flex items-center gap-1.5 flex-shrink-0">
                            <RotateCcw size={13} /> Reopen
                        </button>
                    )}
                </div>

                <div className="flex-1 space-y-3 my-4">
                    {messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                m.sender === "admin"
                                    ? "bg-slate-900 text-white rounded-br-md"
                                    : "bg-card border border-border text-foreground rounded-bl-md shadow-sm"
                            }`}>
                                {m.text}
                                <p className={`text-[9px] mt-1.5 ${m.sender === "admin" ? "text-slate-400" : "text-muted-foreground"}`}>{fmtTime(m.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                <div className="sticky bottom-24 bg-background pt-2">
                    <div className="flex gap-2 items-end bg-card border border-border rounded-2xl p-2 shadow-sm">
                        <textarea
                            value={reply}
                            onChange={e => setReply(e.target.value)}
                            placeholder="Reply as I M Smrti Support…"
                            rows={2}
                            maxLength={3000}
                            className="flex-1 resize-none text-sm p-2 focus:outline-none bg-transparent"
                        />
                        <button
                            onClick={sendReply}
                            disabled={!reply.trim() || sending}
                            aria-label="Send reply"
                            className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Inbox list ───────────────────────────────────────────────
    return (
        <div className="py-6 space-y-5 pb-32 px-4 max-w-lg mx-auto w-full">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/admin")} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Inbox size={20} className="text-blue-600" /> Support Inbox
                    </h1>
                    <p className="text-xs text-muted-foreground">{openCount} open · {unreadCount} unread</p>
                </div>
            </div>

            <div className="flex gap-2">
                {(["open", "all"] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                            filter === f ? "bg-slate-900 text-white" : "bg-card border border-border text-muted-foreground"
                        }`}
                    >
                        {f === "open" ? `Open (${openCount})` : "All"}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div>
            ) : shown.length === 0 ? (
                <div className="text-center py-12">
                    <LifeBuoy size={28} className="text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm font-bold text-muted-foreground">{filter === "open" ? "No open tickets. Inbox zero!" : "No tickets yet."}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {shown.map(tk => (
                        <button
                            key={tk.id}
                            onClick={() => setActiveId(tk.id)}
                            className="w-full p-4 bg-card rounded-2xl border border-border shadow-sm flex items-center gap-3 text-left hover:border-blue-300 transition-colors"
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tk.unreadForAdmin ? "bg-blue-500" : tk.status === "open" ? "bg-amber-400" : "bg-emerald-400"}`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${tk.unreadForAdmin ? "font-black" : "font-semibold"}`}>{tk.subject}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {tk.userName || tk.userContact || "Unknown"} · {fmtTime(tk.lastMessageAt)}
                                </p>
                            </div>
                            {tk.status === "open"
                                ? <Clock size={14} className="text-amber-500 flex-shrink-0" />
                                : <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
