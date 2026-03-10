import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
// @ts-ignore
import "jspdf-autotable";
import {
    collection,
    doc,
    addDoc,
    getDocs,
    updateDoc,
    setDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    arrayUnion,
    increment,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import {
    Bot,
    Send,
    Loader2,
    AlertTriangle,
    User,
    ArrowLeft,
    FileText,
    Check,
    X,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, DocumentResultCard, PendingAction } from "@/types/chat";

// ─── Constants ───────────────────────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const MAX_TOOL_ROUNDS = 8;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeminiPart {
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
    role: "user" | "model";
    parts: GeminiPart[];
}

interface ConfirmationState {
    chatId: string;
    actions: PendingAction[];
    writeCalls: Array<{ name: string; args: Record<string, unknown> }>;
}

// ─── Tool declarations for Gemini ────────────────────────────────────────────

const READ_TOOLS = new Set([
    "search_documents",
    "get_recent_documents",
    "list_patients",
    "list_life_events",
    "summarize_documents",
    "prepare_doctor_visit",
    "compile_to_pdf",
]);

const TOOL_DECLARATIONS = [
    {
        name: "search_documents",
        description:
            "Search the user's medical documents by keywords, medical condition, body part, symptom, doctor name, hospital, or lab. Returns matching documents with AI-generated summary snippets.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: {
                    type: "STRING",
                    description:
                        "Search terms (e.g. 'blood sugar', 'broken leg', 'Dr. Sharma', 'Apollo hospital', 'prescription')",
                },
                patientId: { type: "STRING", description: "Optional: filter results to a specific patient by their ID" },
                category: {
                    type: "STRING",
                    description:
                        "Optional: filter by category. Valid values: Lab Report, Prescription, Scan/Imaging, Doctor's Note, Discharge Summary, Insurance, Other",
                },
                dateFrom: { type: "STRING", description: "Optional: filter documents on or after this date (YYYY-MM-DD)" },
                dateTo: { type: "STRING", description: "Optional: filter documents on or before this date (YYYY-MM-DD)" },
            },
            required: ["query"],
        },
    },
    {
        name: "get_recent_documents",
        description: "Get the most recently uploaded documents. Use this when the user says 'my last N documents' or 'recent documents'.",
        parameters: {
            type: "OBJECT",
            properties: {
                limit: { type: "NUMBER", description: "How many documents to fetch (default 10, max 50)" },
                patientId: { type: "STRING", description: "Optional: filter by patient ID" },
            },
            required: [],
        },
    },
    {
        name: "list_patients",
        description:
            "List all patient profiles associated with this account. Always call this first when you need patient IDs for other operations.",
        parameters: { type: "OBJECT", properties: {}, required: [] },
    },
    {
        name: "list_life_events",
        description:
            "List health timeline events. Returns events with their IDs, titles, dates, categories, and linked document IDs.",
        parameters: {
            type: "OBJECT",
            properties: {
                patientId: { type: "STRING", description: "Optional: filter events for a specific patient" },
            },
            required: [],
        },
    },
    {
        name: "link_document_to_event",
        description:
            "Link a document to an existing life event on the health timeline. This REQUIRES USER CONFIRMATION — it will be shown to the user before executing. Use documentName and eventTitle for the confirmation display.",
        parameters: {
            type: "OBJECT",
            properties: {
                documentId: { type: "STRING", description: "Firestore ID of the document to link" },
                eventId: { type: "STRING", description: "Firestore ID of the life event" },
                documentName: { type: "STRING", description: "Human-readable document name (for confirmation UI)" },
                eventTitle: { type: "STRING", description: "Human-readable event title (for confirmation UI)" },
            },
            required: ["documentId", "eventId", "documentName", "eventTitle"],
        },
    },
    {
        name: "create_life_event",
        description:
            "Create a new life event on the health timeline. REQUIRES USER CONFIRMATION before executing.",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING", description: "Event title (e.g., 'Diabetes Checkup', 'Knee X-Ray')" },
                date: { type: "STRING", description: "Event date in YYYY-MM-DD format" },
                category: {
                    type: "STRING",
                    description: "One of: visit, diagnosis, procedure, milestone, note",
                },
                patientId: { type: "STRING", description: "Firestore ID of the patient" },
                description: { type: "STRING", description: "Optional description of the event" },
            },
            required: ["title", "date", "category", "patientId"],
        },
    },
    {
        name: "update_life_event",
        description: "Update an existing life event's details. REQUIRES USER CONFIRMATION before executing.",
        parameters: {
            type: "OBJECT",
            properties: {
                eventId: { type: "STRING", description: "Firestore ID of the event to update" },
                eventTitle: { type: "STRING", description: "Current event title (for confirmation display)" },
                updates: {
                    type: "OBJECT",
                    description: "Fields to update",
                    properties: {
                        title: { type: "STRING" },
                        date: { type: "STRING" },
                        description: { type: "STRING" },
                        category: { type: "STRING" },
                    },
                },
            },
            required: ["eventId", "eventTitle", "updates"],
        },
    },
    {
        name: "update_document_metadata",
        description:
            "Update a document's metadata such as name, date, category, or assigned patient. REQUIRES USER CONFIRMATION before executing.",
        parameters: {
            type: "OBJECT",
            properties: {
                documentId: { type: "STRING", description: "Firestore ID of the document to update" },
                documentName: { type: "STRING", description: "Current document name (for confirmation display)" },
                updates: {
                    type: "OBJECT",
                    description: "Fields to update",
                    properties: {
                        name: { type: "STRING" },
                        docDate: { type: "STRING" },
                        category: { type: "STRING" },
                        patientId: { type: "STRING" },
                        doctorName: { type: "STRING" },
                    },
                },
            },
            required: ["documentId", "documentName", "updates"],
        },
    },
    {
        name: "summarize_documents",
        description: "Summarize a list of documents. Returns a single cohesive summary of all provided document IDs.",
        parameters: {
            type: "OBJECT",
            properties: {
                documentIds: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "List of Firestore document IDs to summarize together"
                }
            },
            required: ["documentIds"],
        },
    },
    {
        name: "prepare_doctor_visit",
        description: "Prepare a package of relevant health documents for a doctor visit based on the reason for the visit (e.g., 'leg pain', 'broken arm'). Searches history and compiles a summary and list of files.",
        parameters: {
            type: "OBJECT",
            properties: {
                reason: { type: "STRING", description: "The reason or symptom for the visit" },
                patientId: { type: "STRING", description: "The ID of the patient going to the visit" }
            },
            required: ["reason", "patientId"],
        },
    },
    {
        name: "compile_to_pdf",
        description: "Compile a cohesive health summary and list of related documents into a PDF file for the user to download. Use this when the user says 'give me a file' or 'create a PDF'.",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING", description: "Title of the report (e.g., 'Leg Pain History')" },
                summary: { type: "STRING", description: "A cohesive narrative summary to include in the PDF" },
                documentIds: { 
                    type: "ARRAY", 
                    items: { type: "STRING" },
                    description: "List of document IDs to list in the document table of the PDF"
                }
            },
            required: ["title", "summary", "documentIds"],
        },
    },
];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a smart health data assistant for "My Health Memoir", a personal health records app for Indian users.

You have access to the user's health data through tools. Use them to help users manage their records.

CAPABILITIES:
- Search documents by medical condition, symptom, doctor, hospital, date (use search_documents)
- Fetch recent uploads (use get_recent_documents)
- View patient profiles and timeline events (use list_patients, list_life_events)
- Link documents to timeline events (use link_document_to_event — requires confirmation)
- Create new timeline events (use create_life_event — requires confirmation)
- Update event or document details (use update_life_event, update_document_metadata — requires confirmation)
- Summarize multiple reports into one (use summarize_documents)
- Prepare a package for a doctor visit by gathering relevant context (use prepare_doctor_visit)

RULES:
1. DELETION: You NEVER have the authority to delete any document, event, or patient. If a user asks to delete something, you MUST say: "I don't have the authority to delete documents. You can do this yourself by following these steps: 1. Go to Documents page 2. Find the file 3. Click the Edit icon 4. Click Delete."
2. Write operations (link, create, update) always go through a confirmation dialog. Always use the appropriate tool — do not ask the user "shall I proceed?" before calling the tool.
3. Automatically organize: If a user tells you they have documents and want them saved/organized, identify the patient, date, and event, then use create_life_event and update_document_metadata to organize them.
4. When linking documents to events by date: first call list_patients and list_life_events to see existing events, then call get_recent_documents or search_documents to get the docs, then propose linkings using link_document_to_event or create_life_event.
5. Always call list_patients first when you need patient IDs.
6. Be concise. Avoid long preambles. Get to the answer quickly.
7. For medical questions, always add: ⚠️ *Please consult a qualified doctor — this is not medical advice.*
8. You are NOT a substitute for professional medical advice.

DOCUMENT CATEGORIES: Lab Report, Prescription, Scan/Imaging, Doctor's Note, Discharge Summary, Insurance, Other
EVENT CATEGORIES: visit, diagnosis, procedure, milestone, note`;

// ─── Helper: describe a write action in human-readable terms ─────────────────

function describeAction(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
        case "link_document_to_event":
            return `Link "${args.documentName}" → event "${args.eventTitle}"`;
        case "create_life_event":
            return `Create new ${args.category} event: "${args.title}" on ${args.date}`;
        case "update_life_event": {
            const u = args.updates as Record<string, string>;
            const parts = Object.entries(u)
                .map(([k, v]) => `${k} → "${v}"`)
                .join(", ");
            return `Update event "${args.eventTitle}": ${parts}`;
        }
        case "update_document_metadata": {
            const u = args.updates as Record<string, string>;
            const parts = Object.entries(u)
                .map(([k, v]) => `${k} → "${v}"`)
                .join(", ");
            return `Update document "${args.documentName}": ${parts}`;
        }
        default:
            return `Execute ${toolName}`;
    }
}

// ─── Document Card component ──────────────────────────────────────────────────

function DocumentCard({ card }: { card: DocumentResultCard }) {
    const [expanded, setExpanded] = useState(false);
    const snippet = card.summarySnippet || "";
    const truncated = snippet.length > 150;

    return (
        <div className="glass-card rounded-[1.25rem] border border-white/40 p-4 flex gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText size={17} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13px] leading-tight">{card.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {card.docDate && (
                        <span className="text-[11px] text-slate-500">{card.docDate}</span>
                    )}
                    {card.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                            {card.category}
                        </span>
                    )}
                </div>
                {(card.doctorName || card.hospital) && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        {[card.doctorName, card.hospital].filter(Boolean).join(" · ")}
                    </p>
                )}
                {snippet && (
                    <div className="mt-2">
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            {expanded ? snippet : snippet.slice(0, 150) + (truncated ? "..." : "")}
                        </p>
                        {truncated && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="flex items-center gap-0.5 text-[11px] text-primary font-medium mt-1"
                            >
                                {expanded ? (
                                    <><ChevronUp size={12} /> Show less</>
                                ) : (
                                    <><ChevronDown size={12} /> Show more</>
                                )}
                            </button>
                        )}
                    </div>
                )}
                <div className="mt-3">
                    <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                    >
                        <ExternalLink size={11} /> Open
                    </a>
                </div>
            </div>
        </div>
    );
}

// ─── Confirmation panel ───────────────────────────────────────────────────────

function ConfirmationPanel({
    actions,
    onConfirm,
    onCancel,
    isExecuting,
}: {
    actions: PendingAction[];
    onConfirm: () => void;
    onCancel: () => void;
    isExecuting: boolean;
}) {
    return (
        <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                <Zap size={16} />
            </div>
            <div className="max-w-[85%] glass-card border border-amber-200/60 bg-amber-50/40 rounded-[1.25rem] rounded-tl-sm px-5 py-4 shadow-sm">
                <p className="text-[13px] font-semibold text-slate-700 mb-3">
                    I'd like to make these changes:
                </p>
                <div className="space-y-2 mb-4">
                    {actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[10px] font-bold text-amber-700">{i + 1}</span>
                            </div>
                            <p className="text-[12px] text-slate-700 font-medium leading-snug">
                                {action.description}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onConfirm}
                        disabled={isExecuting}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
                    >
                        {isExecuting ? (
                            <Loader2 size={13} className="animate-spin" />
                        ) : (
                            <Check size={13} />
                        )}
                        {isExecuting ? "Applying..." : "Confirm All"}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isExecuting}
                        className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[12px] font-semibold hover:bg-slate-50 disabled:opacity-50 transition-all"
                    >
                        <X size={13} /> Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main AIChatPage component ────────────────────────────────────────────────

export function AIChatPage() {
    const { chatId: chatIdParam } = useParams<{ chatId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const isNewChat = !chatIdParam || chatIdParam === "new";

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(
        isNewChat ? null : chatIdParam ?? null
    );
    const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(!isNewChat);

    const geminiHistoryRef = useRef<GeminiContent[]>([]);
    const pendingDocResultsRef = useRef<DocumentResultCard[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, confirmation, isLoading]);

    // Pre-fill input from navigation state (from ChatListPage suggestions)
    useEffect(() => {
        const state = location.state as { prefill?: string } | null;
        if (state?.prefill) {
            setInput(state.prefill);
            inputRef.current?.focus();
        }
    }, [location.state]);

    // Load existing chat history
    useEffect(() => {
        if (isNewChat || !chatIdParam || !user) {
            setLoadingHistory(false);
            return;
        }
        setLoadingHistory(true);
        const q = query(
            collection(db, "users", user.uid, "chats", chatIdParam, "messages"),
            orderBy("timestamp", "asc")
        );
        getDocs(q).then((snap) => {
            const loaded: ChatMessage[] = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ChatMessage, "id">),
            }));
            setMessages(loaded);
            // Build initial Gemini history from text messages only
            geminiHistoryRef.current = loaded
                .filter((m) => !m.pendingActions)
                .map((m) => ({
                    role: m.role,
                    parts: [{ text: m.content }],
                }));
            setLoadingHistory(false);
        });
    }, [chatIdParam, isNewChat, user]);

    // ── Call Gemini non-streaming ──────────────────────────────────────────────

    const callGemini = useCallback(async (history: GeminiContent[]) => {
        const res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: history,
                tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
                tool_config: { function_calling_config: { mode: "AUTO" } },
                generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            }),
        });
        if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
        return res.json();
    }, []);

    // ── Execute a single tool ─────────────────────────────────────────────────

    const executeTool = useCallback(
        async (
            toolName: string,
            args: Record<string, unknown>
        ): Promise<unknown> => {
            if (!user) return { error: "Not authenticated" };

            switch (toolName) {
                case "search_documents": {
                    const { query: q, patientId, category } = args as Record<string, string>;
                    const snap = await getDocs(
                        query(collection(db, "documents"), where("userId", "==", user.uid))
                    );
                    const lq = (q || "").toLowerCase();
                    const results: DocumentResultCard[] = [];
                    snap.forEach((d) => {
                        const data = d.data();
                        if (patientId && data.patientId !== patientId) return;
                        if (category && data.category !== category) return;
                        
                        const text = (data.name + " " + (data.aiSummary || "") + " " + (data.doctorName || "") + " " + (data.hospital || "")).toLowerCase();
                        if (text.includes(lq) || lq.split(" ").some(word => word.length > 3 && text.includes(word))) {
                            results.push({
                                id: d.id,
                                name: data.name || "Untitled",
                                docDate: data.docDate || "",
                                category: data.category || "Other",
                                summarySnippet: data.aiSummary ? String(data.aiSummary).slice(0, 400) : "",
                                doctorName: data.doctorName,
                                hospital: data.hospital,
                                url: data.url,
                            });
                        }
                    });
                    return results;
                }

                case "get_recent_documents": {
                    const { limit: lim = 5, patientId } = args as { limit?: number; patientId?: string };
                    const snap = await getDocs(
                        query(
                            collection(db, "documents"),
                            where("userId", "==", user.uid)
                        )
                    );
                    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    if (patientId) {
                        docs = docs.filter((d: any) => d.patientId === patientId);
                    }
                    // Client-side sort & limit
                    return docs
                        .sort((a: any, b: any) => (b.createdAt || "").toString().localeCompare((a.createdAt || "").toString()))
                        .slice(0, Math.min(Number(lim), 50))
                        .map((data: any) => ({
                            id: data.id,
                            name: data.name || "Untitled",
                            docDate: data.docDate || "",
                            category: data.category || "Other",
                            summarySnippet: data.aiSummary ? String(data.aiSummary).slice(0, 400) : "",
                            doctorName: data.doctorName,
                            hospital: data.hospital,
                            url: data.url,
                        } as DocumentResultCard));
                }

                case "list_patients": {
                    const snap = await getDocs(
                        query(collection(db, "patients"), where("userId", "==", user.uid))
                    );
                    return snap.docs.map((d) => ({
                        id: d.id,
                        name: d.data().name || "Unknown",
                        dob: d.data().dob,
                        gender: d.data().gender,
                        bloodGroup: d.data().bloodGroup,
                    }));
                }

                case "list_life_events": {
                    const { patientId } = args as { patientId?: string };
                    const constraints = [
                        where("userId", "==", user.uid),
                        orderBy("date", "desc"),
                    ];
                    if (patientId) constraints.splice(1, 0, where("patientId", "==", patientId));
                    const snap = await getDocs(query(collection(db, "life_events"), ...constraints));
                    return snap.docs.map((d) => ({
                        id: d.id,
                        title: d.data().title,
                        date: d.data().date,
                        category: d.data().category,
                        patientId: d.data().patientId,
                        documentIds: d.data().documentIds || [],
                    }));
                }

                // Write tools — only called after confirmation
                case "link_document_to_event": {
                    const { documentId, eventId } = args as { documentId: string; eventId: string };
                    await updateDoc(doc(db, "life_events", eventId), {
                        documentIds: arrayUnion(documentId),
                    });
                    return { success: true };
                }

                case "create_life_event": {
                    const { title, date, category, patientId, description } = args as Record<string, string>;
                    const ref = await addDoc(collection(db, "life_events"), {
                        userId: user.uid,
                        patientId,
                        title,
                        date,
                        category,
                        description: description || "",
                        documentIds: [],
                        createdAt: serverTimestamp(),
                    });
                    return { success: true, eventId: ref.id };
                }

                case "update_life_event": {
                    const { eventId, updates } = args as { eventId: string; updates: Record<string, string> };
                    await updateDoc(doc(db, "life_events", eventId), updates);
                    return { success: true };
                }

                case "update_life_event": {
                    const { eventId, updates } = args as { eventId: string; updates: Record<string, string> };
                    await updateDoc(doc(db, "life_events", eventId), updates);
                    return { success: true };
                }

                case "update_document_metadata": {
                    const { documentId, updates } = args as { documentId: string; updates: Record<string, string> };
                    await updateDoc(doc(db, "documents", documentId), updates);
                    return { success: true };
                }

                case "summarize_documents": {
                    const { documentIds } = args as { documentIds: string[] };
                    const results: any[] = [];
                    for (const id of documentIds) {
                        const dSnap = await getDocs(query(collection(db, "documents"), where("__name__", "==", id)));
                        if (!dSnap.empty) {
                            const data = dSnap.docs[0].data();
                            results.push({
                                id,
                                name: data.name,
                                docDate: data.docDate,
                                summary: data.aiSummary || "No summary available."
                            });
                        }
                    }
                    return results;
                }

                case "prepare_doctor_visit": {
                    const { reason, patientId } = args as { reason: string; patientId: string };
                    const lq = reason.toLowerCase();
                    const snap = await getDocs(
                        query(
                            collection(db, "documents"),
                            where("userId", "==", user.uid)
                        )
                    );
                    
                    const matches: any[] = [];
                    snap.forEach((d) => {
                        const data = d.data();
                        if (data.patientId !== patientId) return; // Client-side filter to avoid index requirement
                        
                        const text = (data.name + " " + (data.aiSummary || "") + " " + (data.category || "")).toLowerCase();
                        if (text.includes(lq) || lq.split(" ").some(word => word.length > 3 && text.includes(word))) {
                            matches.push({
                                id: d.id,
                                name: data.name,
                                date: data.docDate || "Unknown",
                                summary: data.aiSummary || "N/A",
                                url: data.url
                            });
                        }
                    });
                    return {
                        reason,
                        relevantDocuments: matches,
                        recommendation: "I have gathered these documents that seem relevant to your visit. You can ask me to compile them into a PDF for your doctor."
                    };
                }

                case "compile_to_pdf": {
                    const { title, summary, documentIds } = args as { title: string; summary: string; documentIds: string[] };
                    const docs: any[] = [];
                    for (const id of documentIds) {
                        const dSnap = await getDocs(query(collection(db, "documents"), where("__name__", "==", id)));
                        if (!dSnap.empty) {
                            const data = dSnap.docs[0].data();
                            docs.push({
                                date: data.docDate || "N/A",
                                name: data.name || "Untitled",
                                summary: data.aiSummary || "N/A"
                            });
                        }
                    }
                    generateHealthReportPDF(title, summary, docs);
                    return { success: true, message: `PDF "${title}" has been generated and downloaded.` };
                }

                default:
                    return { error: `Unknown tool: ${toolName}` };
            }
        },
        [user]
    );

    // ── PDF Generation Logic ──────────────────────────────────────────────────

    const generateHealthReportPDF = useCallback((title: string, content: string, documents: any[]) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Title
        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185); // Blue
        doc.text("My Health Memoir - Health Record Package", 14, 22);
        
        doc.setFontSize(16);
        doc.setTextColor(50);
        doc.text(title, 14, 32);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, 14, 38);

        // Horizontal Line
        doc.setDrawColor(200);
        doc.line(14, 42, pageWidth - 14, 42);

        // Content / Summary
        doc.setFontSize(12);
        doc.setTextColor(0);
        const splitContent = doc.splitTextToSize(content, pageWidth - 28);
        doc.text(splitContent, 14, 52);

        let currentY = 52 + (splitContent.length * 7) + 10;

        // Documents Table
        if (documents.length > 0) {
            doc.setFontSize(14);
            doc.text("Included Documents", 14, currentY);
            currentY += 8;

            const tableData = documents.map(d => [d.date || "N/A", d.name || "Untitled", d.summary ? d.summary.substring(0, 100) + "..." : "N/A"]);
            autoTable(doc, {
                startY: currentY,
                head: [['Date', 'Document Name', 'Summary Snapshot']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }, // Fixed headStyles property
            });
        }

        doc.save(`${title.replace(/\s+/g, '_')}_health_record.pdf`);
    }, []);

    // ── Save a model message to Firestore + state ─────────────────────────────

    const saveModelMessage = useCallback(
        async (chatId: string, content: string, docResults?: DocumentResultCard[]) => {
            const msgData: Record<string, unknown> = {
                role: "model",
                content,
                timestamp: serverTimestamp(),
            };
            if (docResults && docResults.length > 0) {
                msgData.documentResults = docResults;
            }
            const msgRef = await addDoc(
                collection(db, "users", user!.uid, "chats", chatId, "messages"),
                msgData
            );
            const newMsg: ChatMessage = {
                id: msgRef.id,
                role: "model",
                content,
                timestamp: Timestamp.now(),
                documentResults: docResults?.length ? docResults : undefined,
            };
            setMessages((prev) => [...prev, newMsg]);
            await updateDoc(doc(db, "users", user!.uid, "chats", chatId), {
                updatedAt: serverTimestamp(),
                messageCount: increment(1),
            });
            pendingDocResultsRef.current = [];
        },
        [user]
    );

    // ── Agent loop ────────────────────────────────────────────────────────────

    const runAgentLoop = useCallback(
        async (chatId: string, rounds = 0): Promise<void> => {
            if (rounds >= MAX_TOOL_ROUNDS) {
                await saveModelMessage(
                    chatId,
                    "I've reached the maximum steps for this request. Please try a simpler query or break it into smaller parts."
                );
                return;
            }

            let response;
            try {
                response = await callGemini(geminiHistoryRef.current);
            } catch (err) {
                console.error("Gemini API error:", err);
                await saveModelMessage(chatId, "Sorry, I ran into an error. Please try again.");
                return;
            }

            const parts: GeminiPart[] = response?.candidates?.[0]?.content?.parts ?? [];
            if (parts.length === 0) {
                await saveModelMessage(chatId, "I didn't get a valid response. Please try again.");
                return;
            }

            // Add model response to history
            geminiHistoryRef.current.push({ role: "model", parts });

            const functionCallParts = parts.filter((p) => p.functionCall);
            const textContent = parts
                .filter((p) => p.text)
                .map((p) => p.text!)
                .join("");

            // No tool calls — pure text response
            if (functionCallParts.length === 0) {
                const docResults = [...pendingDocResultsRef.current];
                await saveModelMessage(chatId, textContent || "Done.", docResults.length ? docResults : undefined);
                return;
            }

            // Classify tools
            const readCalls = functionCallParts.filter((p) => READ_TOOLS.has(p.functionCall!.name));
            const writeCalls = functionCallParts.filter((p) => !READ_TOOLS.has(p.functionCall!.name));

            // Execute read tools immediately
            const functionResponses: GeminiPart[] = [];
            for (const part of readCalls) {
                const { name, args } = part.functionCall!;
                try {
                    const result = await executeTool(name, args);
                    functionResponses.push({
                        functionResponse: { name, response: { result } },
                    });
                    // Collect document results for display
                    if (
                        (name === "search_documents" || name === "get_recent_documents") &&
                        Array.isArray(result) &&
                        result.length > 0
                    ) {
                        pendingDocResultsRef.current.push(...(result as DocumentResultCard[]));
                    }
                } catch (err) {
                    console.error(`Tool ${name} error:`, err);
                    functionResponses.push({
                        functionResponse: { name, response: { error: "Tool execution failed" } },
                    });
                }
            }

            if (functionResponses.length > 0) {
                geminiHistoryRef.current.push({ role: "user", parts: functionResponses });
            }

            // Write tools — show confirmation
            if (writeCalls.length > 0) {
                const actions: PendingAction[] = writeCalls.map((p) => ({
                    toolName: p.functionCall!.name,
                    description: describeAction(p.functionCall!.name, p.functionCall!.args),
                    args: p.functionCall!.args,
                }));
                setConfirmation({
                    chatId,
                    actions,
                    writeCalls: writeCalls.map((p) => ({
                        name: p.functionCall!.name,
                        args: p.functionCall!.args,
                    })),
                });
                setIsLoading(false);
                return; // Wait for user action
            }

            // All read tools handled — continue loop
            await runAgentLoop(chatId, rounds + 1);
        },
        [callGemini, executeTool, saveModelMessage]
    );

    // ── Send message ──────────────────────────────────────────────────────────

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || isLoading || confirmation || !user) return;

        setInput("");
        setIsLoading(true);

        // Create chat if new
        let activeChatId = currentChatId;
        if (!activeChatId) {
            const chatTitle = text.slice(0, 60) + (text.length > 60 ? "..." : "");
            const chatRef = doc(collection(db, "users", user.uid, "chats"));
            await setDoc(chatRef, {
                title: chatTitle,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                messageCount: 0,
            });
            activeChatId = chatRef.id;
            setCurrentChatId(activeChatId);
            navigate(`/ai-chat/${activeChatId}`, { replace: true });
        }

        // Save user message to Firestore
        const userMsgRef = await addDoc(
            collection(db, "users", user.uid, "chats", activeChatId, "messages"),
            { role: "user", content: text, timestamp: serverTimestamp() }
        );
        await updateDoc(doc(db, "users", user.uid, "chats", activeChatId), {
            updatedAt: serverTimestamp(),
            messageCount: increment(1),
        });

        const userMsg: ChatMessage = {
            id: userMsgRef.id,
            role: "user",
            content: text,
            timestamp: Timestamp.now(),
        };
        setMessages((prev) => [...prev, userMsg]);

        // Add to Gemini history
        geminiHistoryRef.current.push({ role: "user", parts: [{ text }] });

        // Run agent
        await runAgentLoop(activeChatId);
        setIsLoading(false);
    }, [input, isLoading, confirmation, user, currentChatId, navigate, runAgentLoop]);

    // ── Confirm write actions ─────────────────────────────────────────────────

    const handleConfirm = useCallback(async () => {
        if (!confirmation || !user) return;
        setIsExecuting(true);

        const functionResponses: GeminiPart[] = [];
        for (const call of confirmation.writeCalls) {
            try {
                const result = await executeTool(call.name, call.args);
                functionResponses.push({
                    functionResponse: { name: call.name, response: { result } },
                });
            } catch (err) {
                console.error(`Write tool ${call.name} error:`, err);
                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: { error: "Execution failed" },
                    },
                });
            }
        }

        geminiHistoryRef.current.push({ role: "user", parts: functionResponses });

        const chatId = confirmation.chatId;
        setConfirmation(null);
        setIsExecuting(false);
        setIsLoading(true);

        await runAgentLoop(chatId);
        setIsLoading(false);
    }, [confirmation, executeTool, runAgentLoop, user]);

    // ── Cancel write actions ──────────────────────────────────────────────────

    const handleCancel = useCallback(async () => {
        if (!confirmation || !user) return;

        const functionResponses: GeminiPart[] = confirmation.writeCalls.map((call) => ({
            functionResponse: {
                name: call.name,
                response: { cancelled: true, message: "User cancelled this action." },
            },
        }));
        geminiHistoryRef.current.push({ role: "user", parts: functionResponses });

        const chatId = confirmation.chatId;
        setConfirmation(null);
        setIsLoading(true);

        await runAgentLoop(chatId);
        setIsLoading(false);
    }, [confirmation, runAgentLoop, user]);

    // ─── Render ────────────────────────────────────────────────────────────────

    const isInputDisabled = isLoading || !!confirmation;

    return (
        <div className="flex flex-col h-[calc(100vh-8.5rem)] w-full max-w-lg mx-auto relative">
            <div className="absolute inset-0 soft-gradient-bg -z-10 pointer-events-none" />

            {/* Header */}
            <div className="pt-6 pb-2">
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={() => navigate("/ai-chat")}
                        className="w-8 h-8 rounded-xl bg-white/60 border border-white/40 flex items-center justify-center hover:bg-white/80 transition-all shadow-sm"
                    >
                        <ArrowLeft size={16} className="text-slate-600" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold truncate">AI Health Assistant</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    <span>Not a substitute for professional medical advice</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4 custom-scrollbar">
                {loadingHistory && (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {!loadingHistory && messages.length === 0 && !isLoading && (
                    <div className="text-center p-8 glass-card rounded-[2rem] border border-white/40 shadow-sm mt-8">
                        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                            <Bot size={24} className="text-violet-600" />
                        </div>
                        <p className="text-sm font-semibold">How can I help you?</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">
                            I can search your records, link documents to your timeline, or answer health questions.
                        </p>
                        <div className="flex flex-col gap-2">
                            {[
                                "Show all my blood sugar reports",
                                "Link my last 5 documents to events by date",
                                "What does HbA1c level mean?",
                            ].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setInput(s)}
                                    className="flex items-center gap-2 text-[12px] text-left px-3 py-2 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors font-medium"
                                >
                                    <Sparkles size={11} className="flex-shrink-0" />
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn("flex gap-3 items-start", msg.role === "user" && "flex-row-reverse")}
                    >
                        <div
                            className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                                msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-violet-100 text-violet-600"
                            )}
                        >
                            {msg.role === "user" ? <User size={15} /> : <Bot size={15} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-[1.25rem] px-5 py-3.5 text-[14px] leading-relaxed shadow-sm",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm font-medium ml-auto"
                                        : "glass-card border border-white/50 rounded-tl-sm text-slate-800"
                                )}
                            >
                                {msg.role === "model" ? (
                                    <div className="prose prose-sm prose-slate max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    msg.content
                                )}
                            </div>
                            {/* Document result cards */}
                            {msg.documentResults && msg.documentResults.length > 0 && (
                                <div className="mt-3 space-y-2 max-w-[90%]">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1">
                                        {msg.documentResults.length} document{msg.documentResults.length !== 1 ? "s" : ""} found
                                    </p>
                                    {msg.documentResults.map((card) => (
                                        <DocumentCard key={card.id} card={card} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Confirmation panel */}
                {confirmation && (
                    <ConfirmationPanel
                        actions={confirmation.actions}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        isExecuting={isExecuting}
                    />
                )}

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                            <Bot size={15} />
                        </div>
                        <div className="glass-card border border-white/50 rounded-[1.25rem] rounded-tl-sm px-5 py-3.5 shadow-sm">
                            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                                <Loader2 size={14} className="animate-spin text-violet-500" />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="glass-card rounded-[1.75rem] p-2 sm:p-3 shadow-xl shadow-primary/5 mb-4 border border-white/50 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
                <div className="flex gap-2 relative z-10 w-full">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                        placeholder={
                            confirmation
                                ? "Review the proposed changes above..."
                                : "Ask about your health records..."
                        }
                        disabled={isInputDisabled}
                        className="flex-1 px-5 py-3 rounded-[1.25rem] border border-white/40 bg-white/40 backdrop-blur-md text-slate-800 placeholder:text-slate-500 focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={isInputDisabled || !input.trim()}
                        className="w-12 h-12 rounded-[1.25rem] bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 transition-all hover:bg-primary/90 shadow-md flex-shrink-0"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
