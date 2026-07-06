import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    collection, query, where, onSnapshot, addDoc, doc,
    serverTimestamp, orderBy, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
    ArrowLeft, LifeBuoy, Plus, Send, Loader2, ChevronRight,
    CheckCircle2, Clock, Mail, X,
} from "lucide-react";

interface Ticket {
    id: string;
    subject: string;
    status: "open" | "resolved";
    lastMessageAt: any;
    lastSender: "user" | "admin";
    unreadForUser: boolean;
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

export function SupportPage() {
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(searchParams.get("ticket"));
    const [messages, setMessages] = useState<Message[]>([]);
    const [showNew, setShowNew] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const activeTicket = tickets.find(tk => tk.id === activeId) || null;

    // My tickets (realtime)
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "support_tickets"), where("userId", "==", user.uid));
        const unsub = onSnapshot(q, snap => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
            items.sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0));
            setTickets(items);
            setLoading(false);
        }, () => setLoading(false));
        return unsub;
    }, [user]);

    // Active thread (realtime) + mark read
    useEffect(() => {
        if (!user || !activeId) return;
        const q = query(collection(db, "support_tickets", activeId, "messages"), orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, snap => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
        });
        updateDoc(doc(db, "support_tickets", activeId), { unreadForUser: false }).catch(() => undefined);
        return unsub;
    }, [user, activeId]);

    const openTicket = (id: string | null) => {
        setActiveId(id);
        if (id) setSearchParams({ ticket: id }, { replace: true });
        else setSearchParams({}, { replace: true });
    };

    const createTicket = useCallback(async () => {
        if (!user || !subject.trim() || !body.trim() || sending) return;
        setSending(true);
        try {
            const ticketRef = await addDoc(collection(db, "support_tickets"), {
                userId: user.uid,
                userName: userProfile?.displayName || user.displayName || "",
                userContact: user.email || user.phoneNumber || "",
                subject: subject.trim().slice(0, 120),
                status: "open",
                createdAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
                lastSender: "user",
                unreadForAdmin: true,
                unreadForUser: false,
            });
            await addDoc(collection(db, "support_tickets", ticketRef.id, "messages"), {
                sender: "user",
                text: body.trim().slice(0, 3000),
                createdAt: serverTimestamp(),
            });
            setSubject(""); setBody(""); setShowNew(false);
            openTicket(ticketRef.id);
        } catch (e) {
            console.error("Failed to create ticket:", e);
            alert(t("support.error", "Something went wrong. Please try again."));
        } finally {
            setSending(false);
        }
    }, [user, userProfile, subject, body, sending, t]);

    const sendReply = useCallback(async () => {
        if (!user || !activeId || !reply.trim() || sending) return;
        setSending(true);
        try {
            await addDoc(collection(db, "support_tickets", activeId, "messages"), {
                sender: "user",
                text: reply.trim().slice(0, 3000),
                createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, "support_tickets", activeId), {
                lastMessageAt: serverTimestamp(),
                lastSender: "user",
                unreadForAdmin: true,
                status: "open",
            });
            setReply("");
        } catch (e) {
            console.error("Failed to send reply:", e);
        } finally {
            setSending(false);
        }
    }, [user, activeId, reply, sending]);

    // ── Thread view ──────────────────────────────────────────────
    if (activeTicket) {
        return (
            <div className="pb-28 w-full max-w-lg mx-auto px-5 pt-5 flex flex-col min-h-[calc(100dvh-6rem)]">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => openTicket(null)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm flex-shrink-0">
                        <ArrowLeft size={20} className="text-slate-700" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-black tracking-tight text-slate-900 truncate">{activeTicket.subject}</h1>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${activeTicket.status === "open" ? "text-blue-600" : "text-emerald-600"}`}>
                            {activeTicket.status === "open"
                                ? <><Clock size={10} /> {t("support.statusOpen", "Open")}</>
                                : <><CheckCircle2 size={10} /> {t("support.statusResolved", "Resolved")}</>}
                        </span>
                    </div>
                </div>

                <div className="flex-1 space-y-3 mb-4">
                    {messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                m.sender === "user"
                                    ? "bg-blue-600 text-white rounded-br-md"
                                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm"
                            }`}>
                                {m.sender === "admin" && (
                                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-600 mb-1 flex items-center gap-1">
                                        <LifeBuoy size={10} /> {t("support.team", "I M Smrti Support")}
                                    </p>
                                )}
                                {m.text}
                                <p className={`text-[9px] mt-1.5 ${m.sender === "user" ? "text-blue-200" : "text-slate-400"}`}>{fmtTime(m.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                <div className="sticky bottom-24 bg-slate-50 pt-2">
                    <div className="flex gap-2 items-end bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
                        <textarea
                            value={reply}
                            onChange={e => setReply(e.target.value)}
                            placeholder={t("support.replyPlaceholder", "Write a message…")}
                            rows={2}
                            maxLength={3000}
                            className="flex-1 resize-none text-sm p-2 focus:outline-none bg-transparent"
                        />
                        <button
                            onClick={sendReply}
                            disabled={!reply.trim() || sending}
                            aria-label={t("support.send", "Send")}
                            className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-2">{t("support.sla", "We usually reply within 48 hours.")}</p>
                </div>
            </div>
        );
    }

    // ── Ticket list ──────────────────────────────────────────────
    return (
        <div className="pb-32 w-full max-w-lg mx-auto space-y-5 px-5 pt-5">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/profile")} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <ArrowLeft size={20} className="text-slate-700" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <LifeBuoy size={20} className="text-blue-600" />
                        {t("support.title", "Support")}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">{t("support.subtitle", "We're here to help — track every conversation")}</p>
                </div>
            </div>

            <button
                onClick={() => setShowNew(true)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all"
            >
                <Plus size={16} /> {t("support.newRequest", "New Support Request")}
            </button>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
            ) : tickets.length === 0 ? (
                <div className="text-center py-10 px-6">
                    <p className="text-sm font-bold text-slate-500">{t("support.empty", "No conversations yet")}</p>
                    <p className="text-xs text-slate-400 mt-1">{t("support.emptyDesc", "Facing a problem or have a question? Start a request and we'll get back to you here.")}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {tickets.map(tk => (
                        <button
                            key={tk.id}
                            onClick={() => openTicket(tk.id)}
                            className="w-full p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 text-left hover:border-blue-300 transition-colors"
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tk.unreadForUser ? "bg-blue-500" : tk.status === "open" ? "bg-amber-400" : "bg-emerald-400"}`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${tk.unreadForUser ? "font-black text-slate-900" : "font-bold text-slate-700"}`}>{tk.subject}</p>
                                <p className="text-[11px] text-slate-400">
                                    {tk.status === "resolved" ? t("support.statusResolved", "Resolved") : t("support.statusOpen", "Open")} · {fmtTime(tk.lastMessageAt)}
                                </p>
                            </div>
                            {tk.unreadForUser && (
                                <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">{t("support.newReply", "New reply")}</span>
                            )}
                            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-2">
                <Mail size={12} />
                {t("support.emailFallback", "Prefer email?")} <span className="font-bold text-slate-500">hii@imsmrti.app</span>
            </div>

            {/* New ticket modal */}
            {showNew && (
                <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => !sending && setShowNew(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black text-slate-900">{t("support.newRequest", "New Support Request")}</h2>
                            <button onClick={() => setShowNew(false)} disabled={sending} aria-label={t("common.close", "Close")} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                                <X size={16} className="text-slate-500" />
                            </button>
                        </div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t("support.subjectLabel", "Subject")}</label>
                        <input
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            maxLength={120}
                            placeholder={t("support.subjectPlaceholder", "e.g. Can't upload a document")}
                            className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-400 mb-4"
                        />
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t("support.messageLabel", "Message")}</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            maxLength={3000}
                            rows={5}
                            placeholder={t("support.messagePlaceholder", "Describe the problem or question in as much detail as you can…")}
                            className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-400 resize-none mb-5"
                        />
                        <button
                            onClick={createTicket}
                            disabled={!subject.trim() || !body.trim() || sending}
                            className="w-full py-3.5 bg-blue-600 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {t("support.submit", "Send Request")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
