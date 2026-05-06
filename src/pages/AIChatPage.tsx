import { useState, useEffect, useRef, useCallback } from "react";
import { remoteLog } from "@/lib/remoteLog";
import { logUserAction } from "@/lib/audit";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
// @ts-ignore
import "jspdf-autotable";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
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
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
    Eye,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Zap,
    Plus,
    Paperclip,
    Search,
    Download,
} from "lucide-react";
import { cn, downloadFile } from "@/lib/utils";
import type { ChatMessage, DocumentResultCard, PendingAction } from "@/types/chat";
import { useTranslation } from "react-i18next";

interface Document {
    id: string;
    patientId: string;
    name: string;
    type: string;
    url: string;
    aiSummary?: string;
    category?: string;
    docDate?: string;
    createdAt: { seconds: number } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.5-flash";
const API_VERSION = import.meta.env.VITE_GEMINI_API_VERSION ?? "v1beta";
const GEMINI_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL}:generateContent?key=${API_KEY}`;
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

const SYSTEM_PROMPT = `You are a world-class health intelligence assistant for "I M Smrti", a personal health records platform for Indian users.

Your mission is to provide personalized, professional, and accessible health insights by analyzing the user's uploaded medical records and timeline events.

CAPABILITIES:
- Search documents by condition, symptom, doctor, hospital, or date.
- Retrieve recent uploads and health timeline events.
- Perform longitudinal analysis: Compare multiple reports over time (e.g., HbA1c trends, BP patterns).
- Create or link documents to timeline events (requires user confirmation).
- Summarize complex reports into simple, actionable summaries.
- Prepare a comprehensive context package for doctor visits.
- Generate health report PDFs.

TONE & STYLE (CONSTITUTION):
1. MODERN HINGLISH: Use a natural, helpful, and professional Hinglish tone (Hindi grammar with English medical terms). Example: "नमस्ते! मैं आपके पिछले 3 ब्लड रिपोर्ट्स को एनालाइज कर रहा हूँ।"
2. NO BACKEND LEAKAGE: Never output raw JSON, function names, IDs (documentId, patientId), or internal backend logic.
3. CONCISE & EMPATHETIC: Be direct but empathetic. Avoid robotic or long repetitive preambles.
4. MEDICAL DISCLAIMER: For all health-related queries, add: ⚠️ *Please consult a doctor — this is not medical advice.*

OPERATIONAL RULES:
1. Always call 'list_patients' first if you need to know who the records belong to.
2. Deletion: You NEVER have authority to delete. Direct the user to the UI if they ask.
3. Confirmations: All write operations (link, update, create) must be proposed via the appropriate tool.
4. Data Integrity: If a user mentions a new report, offer to organize it into their timeline accurately.

DOCUMENT CATEGORIES: Lab Report, Prescription, Scan/Imaging, Doctor's Note, Discharge Summary, Insurance, Other
EVENT CATEGORIES: visit, diagnosis, procedure, milestone, note`;

// ─── Helper: describe a write action in human-readable terms ─────────────────

function describeAction(toolName: string, args: Record<string, unknown>, t: any): string {
    switch (toolName) {
        case "link_document_to_event":
            return t("chat.actLink", { doc: args.documentName, event: args.eventTitle });
        case "create_life_event":
            return t("chat.actCreateEvent", { cat: args.category, title: args.title, date: args.date });
        case "update_life_event": {
            const u = args.updates as Record<string, string>;
            const parts = Object.entries(u)
                .map(([k, v]) => `${k} → "${v}"`)
                .join(", ");
            return t("chat.actUpdateEvent", { title: args.eventTitle, parts });
        }
        case "update_document_metadata": {
            const u = args.updates as Record<string, string>;
            const parts = Object.entries(u)
                .map(([k, v]) => `${k} → "${v}"`)
                .join(", ");
            return t("chat.actUpdateDoc", { name: args.documentName, parts });
        }
        default:
            return t("chat.actExec");
    }
}

// ─── Document Card component ──────────────────────────────────────────────────

function DocumentCard({ 
    card, 
    onView,
    onDownload,
    isDownloading
}: { 
    card: DocumentResultCard; 
    onView: (url: string, name: string, mimeType?: string) => void;
    onDownload: (url: string, title: string, id: string) => void;
    isDownloading?: boolean;
}) {
    const { t } = useTranslation();
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
                                    <><ChevronUp size={12} /> {t("chat.showLess")}</>
                                ) : (
                                    <><ChevronDown size={12} /> {t("chat.showMore")}</>
                                )}
                            </button>
                        )}
                    </div>
                )}
                <div className="mt-3 flex gap-2">
                    <button
                        onClick={() => onView(card.url, card.name, card.mimeType || "")}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary bg-primary/10 px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors"
                    >
                        <Eye size={13} /> {t("common.view")}
                    </button>
                    <button
                        onClick={() => onDownload(card.url, card.name, card.id)}
                        disabled={isDownloading}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        {isDownloading ? t("common.downloading") : t("common.download")}
                    </button>
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
    const { t } = useTranslation();
    return (
        <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                <Zap size={16} />
            </div>
            <div className="max-w-[85%] glass-card border border-amber-200/60 bg-amber-50/40 rounded-[1.25rem] rounded-tl-sm px-5 py-4 shadow-sm">
                <p className="text-[13px] font-semibold text-slate-700 mb-3">
                    {t("chat.actTitle")}
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
                        {isExecuting ? t("common.applying") : t("chat.confirmBtn")}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isExecuting}
                        className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[12px] font-semibold hover:bg-slate-50 disabled:opacity-50 transition-all"
                    >
                        <X size={13} /> {t("common.cancel")}
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
    const { t } = useTranslation();

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

    // Document Selection & Upload State
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showDocSelector, setShowDocSelector] = useState(false);
    const [availableDocs, setAvailableDocs] = useState<Document[]>([]);
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [selectorLoading, setSelectorLoading] = useState(false);
    const [selectorSearch, setSelectorSearch] = useState("");
    const [patientFilter, setPatientFilter] = useState("all");
    const [patients, setPatients] = useState<{id: string, name: string}[]>([]);

    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerData, setViewerData] = useState({ url: "", title: "", type: "" });
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const handleDocDownload = async (url: string, title: string, docId: string) => {
        if (downloadingDocId) return;
        setDownloadingDocId(docId);
        try {
            await downloadFile(url, title);
        } finally {
            setDownloadingDocId(null);
        }
    };

    const geminiHistoryRef = useRef<GeminiContent[]>([]);
    const pendingDocResultsRef = useRef<DocumentResultCard[]>([]);
    const internalNavigateRef = useRef(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, confirmation, isLoading]);

    // Fetch patients and documents for selector
    useEffect(() => {
        if (!user || !showDocSelector) return;
        setSelectorLoading(true);
        const fetchMeta = async () => {
            const pSnap = await getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)));
            setPatients(pSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
            
            const dSnap = await getDocs(query(collection(db, "documents"), where("userId", "==", user.uid)));
            setAvailableDocs(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
            setSelectorLoading(false);
        };
        fetchMeta();
    }, [user, showDocSelector]);

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
        // Skip reload when sendMessage() triggered an internal route change
        // (from "new" to real chatId) — messages already in state from sendMessage
        if (internalNavigateRef.current) {
            internalNavigateRef.current = false;
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
                    role: ((m.role as string) === "assistant" ? "model" : m.role) as "user" | "model",
                    parts: [{ text: m.content }],
                }));
            setLoadingHistory(false);
        });
    }, [chatIdParam, isNewChat, user]);

    // ── Call Gemini non-streaming ──────────────────────────────────────────────

    const callGemini = useCallback(async (history: GeminiContent[]) => {
        const payload = {
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: history,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            tool_config: { function_calling_config: { mode: "AUTO" } },
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        };

        try {
            const res = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorText = await res.text();
                await remoteLog("AIChat_API_ERROR", { status: res.status, errorText, url: GEMINI_URL.replace(API_KEY, "REDACTED") });
                throw new Error(`AI Error (${res.status}): ${errorText}`);
            }

            const data = await res.json();
            await remoteLog("AIChat_API_SUCCESS", { response: data });
            return data;
        } catch (err: any) {
            await remoteLog("AIChat_EXCEPTION", { message: err.message, stack: err.stack });
            throw err;
        }
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
                                mimeType: data.type || "",
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
                            mimeType: data.type || "",
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
                                summary: data.aiSummary || "No summary available.",
                                mimeType: data.type || ""
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
                                url: data.url,
                                mimeType: data.type || ""
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
        doc.text("I M Smrti - Health Record Package", 14, 22);
        
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
        async (chatId: string, content: string, docResults?: DocumentResultCard[], generatedPdf?: any) => {
            const msgData: Record<string, unknown> = {
                role: "model",
                content,
                timestamp: serverTimestamp(),
            };
            if (docResults && docResults.length > 0) {
                msgData.documentResults = docResults;
            }
            if (generatedPdf) {
                msgData.generatedPdf = generatedPdf;
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
                generatedPdf: generatedPdf || undefined,
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
                // Check if the history has a compile_to_pdf response that we should attach
                let pdfData = undefined;
                const lastUserContent = geminiHistoryRef.current[geminiHistoryRef.current.length - 1];
                if (lastUserContent && lastUserContent.role === "user") {
                    const pdfResponse = lastUserContent.parts.find(p => p.functionResponse?.name === "compile_to_pdf");
                    if (pdfResponse) {
                        // Find the original call for args
                        const modelCall = geminiHistoryRef.current[geminiHistoryRef.current.length - 2];
                        const toolCall = modelCall?.parts.find(p => p.functionCall?.name === "compile_to_pdf");
                        if (toolCall) {
                            pdfData = toolCall.functionCall!.args;
                        }
                    }
                }

                await saveModelMessage(chatId, textContent || "Done.", docResults.length ? docResults : undefined, pdfData);
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

            if (writeCalls.length > 0) {
                const actions: PendingAction[] = writeCalls.map((p) => ({
                    toolName: p.functionCall!.name,
                    description: describeAction(p.functionCall!.name, p.functionCall!.args, t),
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

    // ── Document Upload Logic ───────────────────────────────────────────

    const handleUploadNew = async (file: File) => {
        if (!user) return;
        setIsLoading(true);
        try {
            // 1. Upload to Storage
            const fileName = `${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `documents/${user.uid}/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            const uploadedUrl = await new Promise<string>((resolve, reject) => {
                uploadTask.on("state_changed", 
                    (_snap) => {
                        // Optional: could add an upload progress state here
                    },
                    reject,
                    async () => {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(url);
                    }
                );
            });

            // 2. Save to Firestore
            // We'll assign to "Other"/Unknown by default since we're in a quick chat flow
            // The AI or user can refine this later
            const docRef = await addDoc(collection(db, "documents"), {
                userId: user.uid,
                name: file.name,
                type: file.type,
                url: uploadedUrl,
                category: "Other",
                status: "completed",
                createdAt: serverTimestamp(),
            });

            // 3. Add to selected IDs
            const next = new Set(selectedDocIds);
            next.add(docRef.id);
            setSelectedDocIds(next);
            
            // Refresh available docs so our selection preview finds it
            const dSnap = await getDocs(query(collection(db, "documents"), where("userId", "==", user.uid)));
            setAvailableDocs(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));

        } catch (err) {
            console.error("Upload error:", err);
            alert("Failed to upload document.");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Send message ──────────────────────────────────────────────────────────

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        const attachedIds = Array.from(selectedDocIds);
        
        if ((!text && attachedIds.length === 0) || isLoading || confirmation || !user) return;

        setInput("");
        setSelectedDocIds(new Set());
        setIsLoading(true);

        // Create chat if new
        let activeChatId = currentChatId;
        
        // Log telemetry
        await logUserAction(user.uid, "AI_CHAT_STARTED", `Sent prompt to AI: ${attachedIds.length} doc(s) attached`);
        
        if (!activeChatId) {
            const chatTitle = text 
                ? text.slice(0, 60) + (text.length > 60 ? "..." : "")
                : attachedIds.length > 0 
                    ? `Chat about ${attachedIds.length} documents`
                    : "New Chat";
            const chatRef = doc(collection(db, "users", user.uid, "chats"));
            await setDoc(chatRef, {
                title: chatTitle,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                messageCount: 0,
            });
            activeChatId = chatRef.id;
            setCurrentChatId(activeChatId);
            internalNavigateRef.current = true;
            navigate(`/ai-chat/${activeChatId}`, { replace: true });
        }

        // Save user message to Firestore
        const msgData: any = { 
            role: "user", 
            content: text || "Check these documents", 
            timestamp: serverTimestamp() 
        };
        if (attachedIds.length > 0) {
            msgData.attachedDocIds = attachedIds;
        }

        const userMsgRef = await addDoc(
            collection(db, "users", user.uid, "chats", activeChatId, "messages"),
            msgData
        );
        await updateDoc(doc(db, "users", user.uid, "chats", activeChatId), {
            updatedAt: serverTimestamp(),
            messageCount: increment(1),
        });

        const userMsg: ChatMessage = {
            id: userMsgRef.id,
            role: "user",
            content: text || "Check these documents",
            timestamp: Timestamp.now(),
            attachedDocIds: attachedIds.length > 0 ? attachedIds : undefined
        };
        setMessages((prev) => [...prev, userMsg]);

        // Build prompt with context if docs are attached
        let promptText = text;
        if (attachedIds.length > 0) {
            const attachedContext = attachedIds.map(id => {
                const d = availableDocs.find(doc => doc.id === id);
                return `[Attached Document: ${d?.name || id}, ID: ${id}]`;
            }).join("\n");
            promptText = `${text}\n\nCONTEXT FROM USER ATTACHMENTS:\n${attachedContext}\nPlease acknowledge these documents and use them if relevant to the request.`;
        }

        // Add to Gemini history
        geminiHistoryRef.current.push({ role: "user", parts: [{ text: promptText }] });

        // Run agent
        await runAgentLoop(activeChatId);
        setIsLoading(false);
    }, [input, isLoading, confirmation, user, currentChatId, navigate, runAgentLoop, selectedDocIds, availableDocs]);

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
                        <h1 className="text-lg font-bold truncate">{t("aiChat.title")}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    <span>{t("aiChat.disclaimer")}</span>
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
                    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-violet-200 blur-2xl rounded-full opacity-50 animate-pulse" />
                            <div className="relative w-20 h-20 rounded-[2.5rem] bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-xl shadow-violet-200 flex items-center justify-center">
                                <Bot size={36} className="text-white" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl bg-white border-4 border-slate-50 flex items-center justify-center shadow-lg">
                                <Sparkles size={16} className="text-amber-500" />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold tracking-tight text-slate-800">
                            {t("aiChat.howCanIHelp")}
                        </h2>
                        <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                            {t("aiChat.helpDesc")}
                        </p>

                        <div className="grid grid-cols-1 gap-3 w-full mt-10">
                            {[
                                { 
                                    text: t("aiChat.prompts.blood"), 
                                    icon: "analytics"
                                },
                                { 
                                    text: t("aiChat.prompts.records"), 
                                    icon: "auto_awesome"
                                },
                                { 
                                    text: t("aiChat.prompts.hba1c"), 
                                    icon: "help" 
                                },
                            ].map((s) => (
                                <button
                                    key={s.text}
                                    onClick={() => setInput(s.text)}
                                    className="group relative flex items-center gap-3 p-4 rounded-3xl bg-white/60 border border-white/80 hover:bg-white hover:border-violet-200 transition-all text-left shadow-sm active:scale-[0.98]"
                                >
                                    <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                        <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
                                    </div>
                                    <span className="text-[13px] font-bold text-slate-700 leading-tight">
                                        {s.text}
                                    </span>
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
                                        {msg.documentResults.length} {t("chat.docsFound")}
                                    </p>
                                    {msg.documentResults.map((card) => (
                                        <DocumentCard 
                                            key={card.id} 
                                            card={card} 
                                            onView={(url, title, type) => {
                                                setViewerData({ url, title, type: type || "" });
                                                setViewerOpen(true);
                                            }}
                                            onDownload={(url, title) => handleDocDownload(url, title, card.id)}
                                            isDownloading={downloadingDocId === card.id}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* PDF Report button */}
                            {msg.generatedPdf && (
                                <div className="mt-3 px-1">
                                    <button 
                                        onClick={async () => {
                                            if (isDownloadingPdf) return;
                                            setIsDownloadingPdf(true);
                                            try {
                                                const { title, summary, documentIds } = msg.generatedPdf!;
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
                                                generateHealthReportPDF(title as string, summary as string, docs);
                                            } finally {
                                                setIsDownloadingPdf(false);
                                            }
                                        }}
                                        disabled={isDownloadingPdf}
                                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                        {isDownloadingPdf ? t("chat.compilingPdf") : t("chat.downloadReport")}
                                    </button>
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
                                <span>{t("chat.thinking")}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input and Attachment UI */}
            <div className="space-y-3 pb-6">
                {/* Selected documents preview */}
                {selectedDocIds.size > 0 && (
                    <div className="flex flex-wrap gap-2 px-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {Array.from(selectedDocIds).map(id => {
                            const doc = availableDocs.find(d => d.id === id);
                            return (
                                <div key={id} className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/20">
                                    <FileText size={12} />
                                    <span className="max-w-[120px] truncate">{doc?.name || "Selected Doc"}</span>
                                    <button onClick={() => {
                                        const next = new Set(selectedDocIds);
                                        next.delete(id);
                                        setSelectedDocIds(next);
                                    }} className="hover:text-red-500">
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                        <button 
                            onClick={() => setSelectedDocIds(new Set())}
                            className="text-[10px] text-slate-400 font-bold hover:text-slate-600 uppercase tracking-wider px-1"
                        >
                            {t("chat.clearAll")}
                        </button>
                    </div>
                )}

                <div className="glass-card rounded-[1.75rem] p-2 sm:p-3 shadow-xl shadow-primary/5 border border-white/50 backdrop-blur-xl relative">
                    <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />
                    
                    {/* Attachment Menu Popup */}
                    {showAttachMenu && (
                        <div className="absolute bottom-full left-0 mb-3 w-48 glass-card border border-white/60 shadow-2xl rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-200 z-[110]">
                            <button 
                                onClick={() => { setShowDocSelector(true); setShowAttachMenu(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Search size={16} />
                                </div>
                                {t("chat.selectExisting")}
                            </button>
                            <button 
                                onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 mt-1"
                            >
                                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                                    <Plus size={16} />
                                </div>
                                {t("chat.uploadNew")}
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 relative z-10 w-full">
                        <button
                            onClick={() => setShowAttachMenu(!showAttachMenu)}
                            disabled={isInputDisabled}
                            className={cn(
                                "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all shadow-sm flex-shrink-0",
                                showAttachMenu ? "bg-slate-800 text-white" : "bg-white/60 text-slate-500 hover:bg-white hover:text-primary border border-white/40"
                            )}
                        >
                            <Paperclip size={18} className={showAttachMenu ? "rotate-45 transition-transform" : "transition-transform"} />
                        </button>

                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                            placeholder={
                                confirmation
                                    ? t("aiChat.reviewChanges")
                                    : t("aiChat.placeholder")
                            }
                            disabled={isInputDisabled}
                            className="flex-1 px-5 py-3 rounded-[1.25rem] border border-white/40 bg-white/40 backdrop-blur-md text-slate-800 placeholder:text-slate-500 focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isInputDisabled || (!input.trim() && selectedDocIds.size === 0)}
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

            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,.pdf"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadNew(file);
                    e.target.value = "";
                }}
            />

            {/* Document Selector Modal */}
            {showDocSelector && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <FileText className="text-primary" />
                                    {t("chat.selectDocs")}
                                </h2>
                                <button onClick={() => setShowDocSelector(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder={t("chat.searchDocs")}
                                        value={selectorSearch}
                                        onChange={(e) => setSelectorSearch(e.target.value)}
                                        className="w-full bg-slate-50 border-none rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                </div>
                                <select 
                                    value={patientFilter}
                                    onChange={(e) => setPatientFilter(e.target.value)}
                                    className="bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    <option value="all">{t("chat.allPatients")}</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {selectorLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 size={24} className="animate-spin text-primary" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t("chat.loadingRecords")}</p>
                                </div>
                            ) : availableDocs.length === 0 ? (
                                <div className="text-center py-20 px-10">
                                    <Bot size={32} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-sm font-semibold text-slate-600">{t("chat.noDocs")}</p>
                                    <p className="text-xs text-slate-400 mt-1">{t("chat.noDocsDesc")}</p>
                                </div>
                            ) : (
                                availableDocs
                                    .filter(d => {
                                        const matchesPatient = patientFilter === "all" || d.patientId === patientFilter;
                                        const matchesSearch = d.name.toLowerCase().includes(selectorSearch.toLowerCase());
                                        return matchesPatient && matchesSearch;
                                    })
                                    .map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => {
                                                const next = new Set(selectedDocIds);
                                                if (next.has(doc.id)) next.delete(doc.id);
                                                else next.add(doc.id);
                                                setSelectedDocIds(next);
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all border text-left",
                                                selectedDocIds.has(doc.id) 
                                                    ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20" 
                                                    : "bg-white border-slate-100 hover:border-slate-300"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                                                selectedDocIds.has(doc.id) ? "bg-primary border-primary" : "border-slate-200 bg-white"
                                            )}>
                                                {selectedDocIds.has(doc.id) && <Check size={12} className="text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{doc.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold uppercase tracking-tighter">
                                                        {doc.category || "Other"}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {doc.docDate || "No date"}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-400">
                                {selectedDocIds.size} selected
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowDocSelector(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => setShowDocSelector(false)}
                                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                                >
                                    Add Documents
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewerModal 
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                url={viewerData.url}
                title={viewerData.title}
                type={viewerData.type}
            />
        </div>
    );
}
