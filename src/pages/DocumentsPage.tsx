import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { logUserAction } from "@/lib/audit";
import ReactMarkdown from "react-markdown";
import { collection, query, where, getDocs, updateDoc, doc as fsDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { FileText, Upload, Loader2, Download, Bot, X, Search, Globe, Activity, Edit2, Trash2, Save } from "lucide-react";
import { downloadFile } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { useTranslation } from "react-i18next";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const MODEL_ID = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.5-flash";
const API_VERSION = import.meta.env.VITE_GEMINI_API_VERSION ?? "v1beta";
const API_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_ID}:streamGenerateContent?key=${API_KEY}&alt=sse`;

const TRANSLATION_PROMPT = (lang: string) => `You are a medical & general AI assistant. Translate the following document summary into ${lang}.
Maintain the exact same structure, bullet points, and emojis. Keep the tone simple, clear, and reassuring so a non-medical person can easily understand.
USE MARKDOWN FORMATTING: Translate section headers to '### ' and keep bullet points as '- '. Do not use asterisks (** or *) for bolding.`;

const languages = [
  { id: "English", tKey: "common.language_en" },
  { id: "Hindi", tKey: "common.language_hi" },
  { id: "Hinglish", tKey: "common.language_hinglish" },
  { id: "Marathi", tKey: "common.language_mr" },
  { id: "Gujarati", tKey: "common.language_gu" },
  { id: "Tamil", tKey: "common.language_ta" },
  { id: "Telugu", tKey: "common.language_te" },
  { id: "Bengali", tKey: "common.language_bn" }
];

const CATEGORIES = [
    { name: "Prescription", key: "documents.cat_prescription", icon: "pill", color: "text-purple-600 bg-purple-50" },
    { name: "Lab Report", key: "documents.cat_labreport", icon: "water_drop", color: "text-red-600 bg-red-50" },
    { name: "Imaging (X-ray/MRI)", key: "documents.cat_imagingxraymri", icon: "personal_injury", color: "text-teal-600 bg-teal-50" },
    { name: "Clinical Note", key: "documents.cat_clinicalnote", icon: "stethoscope", color: "text-blue-600 bg-blue-50" },
    { name: "Billing/Insurance", key: "documents.cat_billinginsurance", icon: "receipt_long", color: "text-amber-600 bg-amber-50" },
    { name: "Other", key: "documents.cat_other", icon: "folder", color: "text-slate-600 bg-slate-50" },
];

interface Document {
    id: string;
    patientId: string;
    name: string;
    type: string;
    url: string;
    status?: string;
    aiSummary?: string;
    aiSummaries?: Record<string, string>;
    docType?: string;
    docDate?: string;
    doctorName?: string;
    hospital?: string;
    lab?: string;
    category?: string;
    eventDate?: string;
    episodeId?: string;
    createdAt: { seconds: number } | null;
}

export function DocumentsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();

    // States
    const [docs, setDocs] = useState<Document[]>([]);
    const [patients, setPatients] = useState<{ id: string, name: string }[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("search") || "");
    const [loading, setLoading] = useState(true);
    const [globalLifeEvents, setGlobalLifeEvents] = useState<{ id: string, title?: string, date?: string, documentIds?: string[] }[]>([]);
    const [viewingLinksDoc, setViewingLinksDoc] = useState<Document | null>(null);
    const [isUnlinking, setIsUnlinking] = useState(false);

    // Document Edit State
    const [editingDoc, setEditingDoc] = useState<Document | null>(null);
    const [editDocDraft, setEditDocDraft] = useState({ name: "", docDate: "", patientId: "", doctorName: "", hospital: "", lab: "" });
    const [isSavingDocEdit, setIsSavingDocEdit] = useState(false);
    const [isDeletingDoc, setIsDeletingDoc] = useState(false);

    // Organization States
    const [viewMode, setViewMode] = useState<"dashboard" | "timeline" | "list">("dashboard");
    const [timelineFilterCategory, setTimelineFilterCategory] = useState<string | null>(null);
    const [timelineFilterEpisode, setTimelineFilterEpisode] = useState<string | null>(null);
    const [episodes, setEpisodes] = useState<{ id: string, name: string }[]>([]);

    // Modals state
    const [viewSummary, setViewSummary] = useState<{ text: string, lang: string } | null>(null);
    const [showLanguageModalForDoc, setShowLanguageModalForDoc] = useState<Document | null>(null);
    const [summaryLanguage, setSummaryLanguage] = useState(t("common.localeCode") === "hi-IN" ? "Hindi" : "English");
    const [summarizingDocId, setSummarizingDocId] = useState<string | null>(null);
    const [_generationProgress, setGenerationProgress] = useState<string>("");

    // Add to Timeline state
    const [addToTimelineDoc, setAddToTimelineDoc] = useState<Document | null>(null);
    const [addToTimelineDate, setAddToTimelineDate] = useState("");
    const [lifeEvents, setLifeEvents] = useState<{ id: string, title: string, date: string, patientId: string }[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [addingToTimeline, setAddingToTimeline] = useState(false);
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
    const [addToTimelineDone, setAddToTimelineDone] = useState<string | null>(null);

    // Viewer State
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerData, setViewerData] = useState({ url: "", title: "", type: "" });

    // Initial setup from URL params
    useEffect(() => {
        const fetchPatients = async () => {
            if (!user) return;
            const snap = await getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)));
            const pts = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
            setPatients(pts);

            const paramPatientId = searchParams.get("patientId");
            if (paramPatientId && pts.some(p => p.id === paramPatientId)) {
                setSelectedPatientId(paramPatientId);
            } else if (pts.length > 0 && !paramPatientId && selectedPatientId !== "all") {
                // Default to 'all' instead of forcing the first patient, easier for broad search
                setSelectedPatientId("all");
            } else if (pts.length === 0) {
                setLoading(false);
            }
        };
        fetchPatients();
    }, [user, searchParams]);

    useEffect(() => {
        const fetchDocsAndEvents = async () => {
            if (!user || !selectedPatientId) return;
            setLoading(true);

            // Fetch Life Events globally to calculate linked badges
            try {
                const eSnap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
                setGlobalLifeEvents(eSnap.docs.map(d => ({
                    id: d.id,
                    title: d.data().title,
                    date: d.data().date,
                    documentIds: d.data().documentIds || []
                })));
            } catch (err) {
                console.error("Error fetching global events for badges:", err);
            }

            let q;
            if (selectedPatientId === "all") {
                q = query(
                    collection(db, "documents"),
                    where("userId", "==", user.uid)
                );
            } else {
                q = query(
                    collection(db, "documents"),
                    where("userId", "==", user.uid),
                    where("patientId", "==", selectedPatientId)
                );
            }

            const snap = await getDocs(q);
            setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Document)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
            setLoading(false);
        };
        fetchDocsAndEvents();
    }, [user, selectedPatientId]);

    const handleDocDownload = async (doc: Document) => {
        if (downloadingDocId) return;
        setDownloadingDocId(doc.id);
        try {
            await downloadFile(doc.url, doc.name);
        } catch {
            // downloadFile already shows alert on failure
        }
        setDownloadingDocId(null);
    };

    const openEditDocModal = (doc: Document) => {
        setEditingDoc(doc);
        setEditDocDraft({
            name: doc.name,
            docDate: doc.docDate || doc.eventDate || "",
            patientId: doc.patientId || "",
            doctorName: doc.doctorName || "",
            hospital: doc.hospital || "",
            lab: doc.lab || ""
        });
    };

    const handleSaveDocEdit = async () => {
        if (!editingDoc) return;
        setIsSavingDocEdit(true);
        try {
            await updateDoc(fsDoc(db, "documents", editingDoc.id), {
                name: editDocDraft.name,
                docDate: editDocDraft.docDate,
                patientId: editDocDraft.patientId,
                doctorName: editDocDraft.doctorName,
                hospital: editDocDraft.hospital,
                lab: editDocDraft.lab
            });
            setDocs(docs.map(d => d.id === editingDoc.id ? { ...d, name: editDocDraft.name, docDate: editDocDraft.docDate, patientId: editDocDraft.patientId, doctorName: editDocDraft.doctorName, hospital: editDocDraft.hospital, lab: editDocDraft.lab } : d));
            setEditingDoc(null);
        } catch (e) {
            console.error("Failed to update doc:", e);
            alert(t("documents.saveError"));
        } finally {
            setIsSavingDocEdit(false);
        }
    };

    const handleUnlinkDocFromEvent = async (docId: string, eventId: string) => {
        if (!user) return;
        setIsUnlinking(true);
        try {
            const eventRef = fsDoc(db, "life_events", eventId);
            const event = globalLifeEvents.find(e => e.id === eventId);
            if (!event) return;

            const newDocIds = (event.documentIds || []).filter(id => id !== docId);
            await updateDoc(eventRef, { documentIds: newDocIds });

            // Update local state
            setGlobalLifeEvents(prev => prev.map(e => e.id === eventId ? { ...e, documentIds: newDocIds } : e));
        } catch (e) {
            console.error("Failed to unlink document:", e);
            alert(t("documents.unlinkError"));
        } finally {
            setIsUnlinking(false);
        }
    };

    const handleDeleteDoc = async () => {
        if (!editingDoc || !user) return;
        if (!confirm(t("documents.deleteConfirm"))) return;
        setIsDeletingDoc(true);
        try {
            // Delete from storage
            const fileRef = ref(storage, `documents/${user.uid}/${editingDoc.id}_${editingDoc.name}`);
            try { await deleteObject(fileRef); } catch (e) { console.warn("Storage delete failed/skipped", e); }

            // Delete from Firestore
            await deleteDoc(fsDoc(db, "documents", editingDoc.id));

            // Log telemetry
            await logUserAction(user.uid, "DOCUMENT_DELETED", `User deleted document: ${editingDoc.name}`, { docId: editingDoc.id });

            setDocs(docs.filter(d => d.id !== editingDoc.id));
            setEditingDoc(null);
        } catch (e) {
            console.error("Failed to delete doc:", e);
            alert(t("documents.deleteError"));
        } finally {
            setIsDeletingDoc(false);
        }
    };

    // Fetch episodes for patient
    useEffect(() => {
        if (user && selectedPatientId !== "all") {
            getDocs(query(collection(db, "episodes"), where("patientId", "==", selectedPatientId)))
                .then(snap => setEpisodes(snap.docs.map(d => ({ id: d.id, name: d.data().name }))));
        } else {
            setEpisodes([]);
            setViewMode("list"); // Default to list if looking at 'all'
        }
    }, [user, selectedPatientId]);

    // Handle Search filter locally
    const filteredDocs = useMemo(() => {
        let currentDocs = docs;

        if (viewMode === "timeline") {
            if (timelineFilterCategory) {
                currentDocs = currentDocs.filter(d => d.category === timelineFilterCategory || d.docType === timelineFilterCategory);
            } else if (timelineFilterEpisode) {
                currentDocs = currentDocs.filter(d => d.episodeId === timelineFilterEpisode);
            }
        }

        const query = searchQuery.trim().toLowerCase();
        if (!query) return currentDocs;
        return currentDocs.filter(d =>
            d.name.toLowerCase().includes(query) ||
            d.type.toLowerCase().includes(query) ||
            (d.docType && d.docType.toLowerCase().includes(query)) ||
            (d.doctorName && d.doctorName.toLowerCase().includes(query)) ||
            (d.hospital && d.hospital.toLowerCase().includes(query)) ||
            (d.lab && d.lab.toLowerCase().includes(query)) ||
            (d.docDate && d.docDate.toLowerCase().includes(query)) ||
            (d.aiSummary && d.aiSummary.toLowerCase().includes(query)) ||
            (d.aiSummaries && Object.values(d.aiSummaries).some(summary => summary.toLowerCase().includes(query)))
        );
    }, [docs, searchQuery, viewMode, timelineFilterCategory, timelineFilterEpisode]);

    // Sync search query to URL to make it shareable / refreshable
    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        const params = new URLSearchParams(searchParams);
        if (val) params.set("search", val);
        else params.delete("search");
        setSearchParams(params, { replace: true });
    };

    const handlePatientChange = (val: string) => {
        setSelectedPatientId(val);
        const params = new URLSearchParams(searchParams);
        if (val && val !== "all") {
            params.set("patientId", val);
            setViewMode("dashboard");
            setTimelineFilterCategory(null);
            setTimelineFilterEpisode(null);
        } else {
            params.delete("patientId");
            setViewMode("list");
        }
        setSearchParams(params, { replace: true });
    };

    const openCategoryTimeline = (categoryName: string) => {
        setTimelineFilterCategory(categoryName);
        setTimelineFilterEpisode(null);
        setViewMode("timeline");
    };

    const openEpisodeTimeline = (episodeId: string) => {
        setTimelineFilterEpisode(episodeId);
        setTimelineFilterCategory(null);
        setViewMode("timeline");
    };

    const openAddToTimeline = async (doc: Document) => {
        setAddToTimelineDoc(doc);
        setSelectedEventId("");
        setAddToTimelineDone(null);
        setAddToTimelineDate(doc.docDate || new Date().toISOString().split('T')[0]);
        // Fetch existing events for this doc's patient
        if (doc.patientId && user) {
            const snap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid), where("patientId", "==", doc.patientId)));
            setLifeEvents(snap.docs.map(d => ({ id: d.id, title: d.data().title, date: d.data().date, patientId: d.data().patientId })));
        } else if (user) {
            const snap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
            setLifeEvents(snap.docs.map(d => ({ id: d.id, title: d.data().title, date: d.data().date, patientId: d.data().patientId })));
        }
    };

    const handleAddDocToEvent = async () => {
        if (!addToTimelineDoc || !user) return;
        setAddingToTimeline(true);
        try {
            if (selectedEventId) {
                // Link doc to existing event
                const eventRef = fsDoc(db, "life_events", selectedEventId);
                const eventSnap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
                const existingEvent = eventSnap.docs.find(d => d.id === selectedEventId);
                const existingIds: string[] = existingEvent?.data().documentIds || [];
                if (!existingIds.includes(addToTimelineDoc.id)) {
                    await updateDoc(eventRef, { documentIds: [...existingIds, addToTimelineDoc.id] });
                }
                setAddToTimelineDone(t("documents.linkSuccess"));
            } else {
                // Create a new event with this doc linked
                await addDoc(collection(db, "life_events"), {
                    userId: user.uid,
                    patientId: addToTimelineDoc.patientId,
                    title: addToTimelineDoc.name.replace(/\.[^/.]+$/, ""),
                    category: "visit",
                    date: addToTimelineDate || addToTimelineDoc.docDate || new Date().toISOString().split('T')[0],
                    description: "",
                    documentIds: [addToTimelineDoc.id],
                    createdAt: serverTimestamp()
                });
                setAddToTimelineDone(t("documents.createSuccess"));
            }
        } catch (e) {
            console.error(e);
            alert(t("documents.addTimelineError"));
        } finally {
            setAddingToTimeline(false);
        }
    };

    const handleGenerateNewSummary = async () => {
        if (!showLanguageModalForDoc) return;
        const docObj = showLanguageModalForDoc;
        const lang = summaryLanguage;

        setShowLanguageModalForDoc(null);
        setSummarizingDocId(docObj.id);
        setGenerationProgress(t("documents.preparingTranslation"));

        try {
            const sourceText = (docObj.aiSummaries && Object.values(docObj.aiSummaries)[0]) || docObj.aiSummary;
            if (!sourceText || docObj.status === "failed") {
                throw new Error("No existing summary found to translate. This document's analysis may have failed. Please try re-uploading.");
            }

            setGenerationProgress(t("documents.translatingSummary", { lang }));
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: `${TRANSLATION_PROMPT(lang)}\n\nOriginal Summary:\n${sourceText}` }
                        ]
                    }],
                    generationConfig: { temperature: 0.2 },
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData?.error?.message || "API Error: AI Generation Failed");
            }

            let newSummary = "";
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || ""; // Keep the last partial line in buffer

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data:")) continue;

                        try {
                            const jsonStr = trimmed.replace(/^data:\s*/, "");
                            if (jsonStr === "[DONE]") continue;
                            const data = JSON.parse(jsonStr);
                            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                            if (text) {
                                newSummary += text;
                                setGenerationProgress(t("documents.typingTranslation"));
                            }
                        } catch (e) {
                            // Ignore partial JSON errors within a line if any
                        }
                    }
                }
            }

            if (newSummary) {
                const safeCurrentSummaries = docObj.aiSummaries || {};

                // Backwards compatibility for single aiSummary without a map
                if (Object.keys(safeCurrentSummaries).length === 0 && docObj.aiSummary) {
                    safeCurrentSummaries["English"] = docObj.aiSummary;
                }

                const newSummariesMap = { ...safeCurrentSummaries, [lang]: newSummary };

                await updateDoc(fsDoc(db, "documents", docObj.id), {
                    aiSummaries: newSummariesMap
                });

                // Update UI instantly
                setDocs(docs => docs.map(d => d.id === docObj.id ? { ...d, aiSummaries: newSummariesMap } : d));
                alert(t("documents.generateSuccess", { lang }));
            } else {
                throw new Error(t("documents.emptySummaryError"));
            }

        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("CORS_ERROR")) {
                alert("Translation Error: Browser blocked the document download. This is a security setting (CORS) on Firebase Storage that needs to be configured by the administrator for 'localhost'.");
            } else {
                alert(t("documents.translationError"));
            }
        } finally {
            setSummarizingDocId(null);
            setGenerationProgress("");
        }
    };

    return (
        <div className="pb-6 w-full max-w-lg mx-auto space-y-6 relative px-4 overflow-x-hidden">
            <div className="fixed top-0 left-0 right-0 h-[50vh] soft-gradient-bg -z-10 pointer-events-none"></div>
            <div className="flex items-center justify-between pt-6">
                <h1 className="text-xl font-bold">{t("documents.title")}</h1>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-xl font-medium cursor-pointer shadow-sm hover:bg-primary/90 transition-colors flex-shrink-0 min-h-[44px]"
                >
                    <Upload size={16} />
                    <span className="hidden xs:inline">{t("documents.upload")}</span>
                </button>
            </div>

            {/* Smart Search & Filter Section */}
            <div className="glass-card rounded-[2rem] p-5 shadow-xl shadow-primary/10 border border-white/40 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder={t("documents.search")}
                        className="w-full pl-12 pr-4 py-3.5 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-md focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-700 shadow-sm outline-none placeholder:text-slate-400"
                    />
                </div>

                {patients.length > 0 && (
                    <div>
                        <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">{t("documents.filterByPatient")}</label>
                        <select
                            value={selectedPatientId}
                            onChange={e => handlePatientChange(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-md focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-700 shadow-sm outline-none cursor-pointer"
                        >
                            <option value="all">{t("documents.allPatients")}</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* View Toggles for Single Patient */}
            {selectedPatientId !== "all" && !loading && (
                <div className="flex bg-white/40 backdrop-blur-md border border-white/40 p-1.5 rounded-[1.25rem] shadow-sm mt-2 relative z-10 w-full mb-4">
                    {/* Icon-only on small screens, icon+label on sm+ */}
                    <button
                        onClick={() => { setViewMode("dashboard"); setTimelineFilterCategory(null); setTimelineFilterEpisode(null); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] ${viewMode === "dashboard" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        <span className="hidden sm:inline">{t("documents.viewDashboard")}</span>
                    </button>
                    <button
                        onClick={() => { setViewMode("timeline"); setTimelineFilterCategory(null); setTimelineFilterEpisode(null); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] ${viewMode === "timeline" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">timeline</span>
                        <span className="hidden sm:inline">{t("documents.viewTimeline")}</span>
                    </button>
                    <button
                        onClick={() => { setViewMode("list"); setTimelineFilterCategory(null); setTimelineFilterEpisode(null); }}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] ${viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"}`}
                    >
                        <span className="material-symbols-outlined text-[20px]">list</span>
                        <span className="hidden sm:inline">{t("documents.viewList")}</span>
                    </button>
                </div>
            )}

            {/* Smart Dashboard View */}
            {viewMode === "dashboard" && selectedPatientId !== "all" && !loading && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-[17px] font-extrabold text-slate-900 ml-1">{t("documents.smartCategories")}</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {CATEGORIES.map(cat => {
                                const count = docs.filter(d => (d.category === cat.name || d.docType === cat.name)).length;
                                return (
                                    <button
                                        key={cat.name}
                                        onClick={() => openCategoryTimeline(cat.name)}
                                        className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[1.5rem] p-4 flex flex-col items-start gap-3 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all text-left"
                                    >
                                        <div className={`size-12 rounded-2xl flex items-center justify-center ${cat.color}`}>
                                            <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                                        </div>
                                        <div>
                                            <span className="text-[14px] font-extrabold text-slate-800 block line-clamp-1">{t(cat.key)}</span>
                                            <span className="text-[12px] font-bold text-slate-500">{t("documents.fileCount", { count })}</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {episodes.length > 0 && (
                        <div className="space-y-4 pt-2 border-t border-slate-200/50">
                            <h2 className="text-[17px] font-extrabold text-slate-900 ml-1">{t("documents.episodesOfCare")}</h2>
                            <div className="grid gap-3">
                                {episodes.map(ep => {
                                    const count = docs.filter(d => d.episodeId === ep.id).length;
                                    return (
                                        <button
                                            key={ep.id}
                                            onClick={() => openEpisodeTimeline(ep.id)}
                                            className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[1.25rem] px-5 py-4 flex items-center justify-between shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-[20px]">medical_services</span>
                                                </div>
                                                <div>
                                                    <span className="text-[15px] font-extrabold text-slate-800 block">{ep.name}</span>
                                                    <span className="text-[12px] font-bold text-slate-500">{t("documents.fileCount", { count })}</span>
                                                </div>
                                            </div>
                                            <span className="material-symbols-outlined text-slate-300 group-hover:text-emerald-500 transition-colors">chevron_right</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Timeline View */}
            {viewMode === "timeline" && !loading && (
                <div className="space-y-6 mt-4 relative">
                    {(timelineFilterCategory || timelineFilterEpisode) && (
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white/40 backdrop-blur-md px-4 py-3 rounded-[1rem] border border-white/60 shadow-sm w-fit mb-4">
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            {t("documents.filteringBy")} <span className="text-primary">{timelineFilterCategory ? t(`documents.cat_${timelineFilterCategory.toLowerCase().replace(/[^a-z]/g, '')}`) : episodes.find(e => e.id === timelineFilterEpisode)?.name}</span>
                            <button onClick={() => { setTimelineFilterCategory(null); setTimelineFilterEpisode(null); }} className="ml-2 hover:text-slate-900"><X size={16} /></button>
                        </div>
                    )}

                    {filteredDocs.length === 0 ? (
                        <div className="glass-card text-center p-12 text-slate-500 rounded-[2rem] border border-white/40 shadow-sm mt-4">
                            <span className="material-symbols-outlined text-4xl opacity-30 block mb-3">timeline</span>
                            <p className="font-bold text-foreground">{t("documents.noDocs")}</p>
                            <p className="text-sm mt-1 max-w-xs mx-auto">{t("documents.noDocsSubtitle")}</p>
                        </div>
                    ) : (
                        <div className="relative pl-5 border-l-2 border-slate-200/60 pb-10 space-y-8">
                            {filteredDocs.sort((a, b) => new Date(b.eventDate || b.docDate || 0).getTime() - new Date(a.eventDate || a.docDate || 0).getTime()).map(doc => {
                                const renderDate = new Date(doc.eventDate || doc.docDate || Date.now()).toLocaleDateString(t("common.localeCode"), { month: 'short', day: 'numeric', year: 'numeric' });
                                return (
                                    <div key={doc.id} className="relative group">
                                        <div className="absolute -left-[27px] top-5 size-4 rounded-full bg-white border-4 border-primary shadow-sm group-hover:scale-125 transition-transform z-10"></div>

                                        {/* Always stacked on mobile, side-by-side on sm+ */}
                                        <div className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[1.5rem] p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-4 relative overflow-hidden">
                                            <div className="flex gap-3 items-start">
                                                {/* Thumbnail — fixed small size so it never dominates */}
                                                <button 
                                                    onClick={() => {
                                                        setViewerData({ url: doc.url, title: doc.name, type: doc.category || doc.type });
                                                        setViewerOpen(true);
                                                    }}
                                                    className="w-14 h-16 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-slate-200 cursor-pointer hover:border-primary/50 transition-colors"
                                                >
                                                    {doc.type.startsWith('image/') ? (
                                                        <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText size={22} className="text-primary/50" />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[11px] font-extrabold text-primary uppercase tracking-wider block">{renderDate}</span>
                                                    <h3 className="font-bold text-[15px] text-slate-800 leading-tight mt-0.5 break-words">{doc.name}</h3>
                                                    {doc.category && (
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                                                            {t(`documents.cat_${doc.category.toLowerCase().replace(/[^a-z]/g, '')}`)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {(doc.hospital || doc.lab || doc.doctorName) && (
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                                                    {doc.doctorName && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><span className="material-symbols-outlined text-[13px]">person</span> <span className="truncate max-w-[100px]">{doc.doctorName}</span></span>}
                                                    {doc.hospital && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><span className="material-symbols-outlined text-[13px]">local_hospital</span> <span className="truncate max-w-[100px]">{doc.hospital}</span></span>}
                                                    {doc.lab && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><span className="material-symbols-outlined text-[13px]">science</span> <span className="truncate max-w-[100px]">{doc.lab}</span></span>}
                                                </div>
                                            )}

                                            {doc.aiSummary && (
                                                <p className="text-[12px] text-slate-600/90 font-medium leading-relaxed line-clamp-2 break-words">
                                                    {doc.aiSummary}
                                                </p>
                                            )}

                                            <div className="flex flex-row gap-2 pt-3 border-t border-slate-100">
                                                {doc.aiSummary && (
                                                    <button onClick={() => setViewSummary({ text: doc.aiSummary || "", lang: "English" })} className="flex-1 py-2 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors text-xs font-bold flex items-center justify-center gap-1.5" title="View Summary">
                                                        <Bot size={15} /> AI
                                                    </button>
                                                )}
                                                <button onClick={() => handleDocDownload(doc)} disabled={downloadingDocId === doc.id} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60" title="Download">
                                                    {downloadingDocId === doc.id ? <Loader2 size={15} className="animate-spin" /> : <><Download size={15} /> <span>Save</span></>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* List View Container */}
            {viewMode === "list" && (
                <div className="space-y-4 mt-2">
                    {!loading && <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">{t("documents.showingResults", { count: filteredDocs.length })}</p>}

                    {!loading && filteredDocs.length === 0 && (
                        <div className="glass-card text-center p-12 text-slate-500 rounded-[2rem] border border-white/40 shadow-sm mt-4">
                            <FileText size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold text-foreground">{t("documents.noDocs")}</p>
                            <p className="text-sm mt-1 max-w-xs mx-auto">{t("documents.searchAdjust")}</p>
                        </div>
                    )}

                    {!loading && filteredDocs.length > 0 && (
                        <div className="grid gap-3">
                            {filteredDocs.map(doc => {
                                const patient = patients.find(p => p.id === doc.patientId);
                                return (
                                    /* Mobile-first list card: thumbnail | info | action column */
                                    <div key={doc.id} className="glass-card rounded-2xl p-3 flex gap-3 items-start shadow-sm border border-white/40 hover:shadow-md hover:border-primary/30 transition-all group overflow-hidden">
                                        {/* Thumbnail */}
                                        <button 
                                            onClick={() => {
                                                setViewerData({ url: doc.url, title: doc.name, type: doc.type });
                                                setViewerOpen(true);
                                            }}
                                            className="w-12 h-12 rounded-xl bg-white flex-shrink-0 overflow-hidden border-2 border-slate-200 shadow-sm hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center"
                                        >
                                            {doc.type.startsWith('image/') ? (
                                                <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <FileText size={22} className="text-primary/70" />
                                            )}
                                        </button>

                                        {/* Info — fills remaining space, truncates */}
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="font-bold text-[13px] text-slate-900 truncate" title={doc.name}>{doc.name}</p>

                                            {/* Type + Patient badges */}
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 rounded-md">
                                                    {doc.type.split("/")[1] ?? doc.type}
                                                </span>
                                                {patient && (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                                                        {patient.name}
                                                    </span>
                                                )}
                                                {(() => {
                                                    const linkCount = globalLifeEvents.filter(e => e.documentIds?.includes(doc.id)).length;
                                                    return linkCount > 0 ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewingLinksDoc(doc); }}
                                                            className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 hover:bg-violet-100 transition-colors"
                                                        >
                                                            <Activity size={9} /> {linkCount}
                                                        </button>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* AI Summary buttons — wrap gracefully */}
                                            <div className="flex gap-1.5 mt-2 flex-wrap">
                                                {doc.aiSummaries && Object.keys(doc.aiSummaries).length > 0 ? (
                                                    Object.entries(doc.aiSummaries).map(([l, text]) => (
                                                        <button key={l} onClick={() => setViewSummary({ text, lang: l })} className="text-[10px] font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 px-2 py-1 flex items-center gap-1 rounded-lg transition-colors">
                                                            <Bot size={11} /> {l}
                                                        </button>
                                                    ))
                                                ) : doc.aiSummary && doc.status !== "failed" ? (
                                                    <button onClick={() => setViewSummary({ text: doc.aiSummary || "", lang: "English" })} className="text-[10px] font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 px-2 py-1 flex items-center gap-1 rounded-lg transition-colors">
                                                        <Bot size={11} /> EN
                                                    </button>
                                                ) : doc.status === "failed" ? (
                                                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">{t("documents.analysisFailed")}</span>
                                                ) : null}

                                                {doc.status !== "failed" && (
                                                    <button onClick={() => setShowLanguageModalForDoc(doc)} disabled={summarizingDocId === doc.id} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 flex items-center gap-1 rounded-lg transition-colors disabled:opacity-50">
                                                        {summarizingDocId === doc.id ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
                                                        {summarizingDocId === doc.id ? "..." : t("common.translate")}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action column — vertical, fixed-width, always right-aligned */}
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                            <button onClick={() => openEditDocModal(doc)} className="size-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Edit">
                                                <Edit2 size={15} />
                                            </button>
                                            <button onClick={() => handleDocDownload(doc)} disabled={downloadingDocId === doc.id} className="size-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-60" title="Download">
                                                {downloadingDocId === doc.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                            </button>
                                            <button onClick={() => openAddToTimeline(doc)} className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors" title="Add to Timeline">
                                                <Activity size={15} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* View Summary Modal */}
            {viewSummary && (
                <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full max-w-2xl glass-card rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5 duration-300 max-h-[92dvh] border border-white/50">
                        <div className="p-6 border-b border-white/30 flex justify-between items-center bg-violet-50/50 rounded-t-[2.5rem] text-violet-900 flex-shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 size-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                            <div className="relative z-10">
                                <h2 className="text-xl font-bold flex items-center gap-2"><Bot size={24} className="text-violet-600" /> {t("documents.aiSummaryTitle", { lang: viewSummary.lang })}</h2>
                                <p className="text-xs font-medium text-violet-700/70 mt-1">{t("documents.aiSummarySubtitle")}</p>
                            </div>
                            <button onClick={() => setViewSummary(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-violet-100 hover:bg-violet-200 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 scroll-smooth custom-scrollbar flex-1 bg-white">
                            <div className="text-[13px] text-slate-600 font-medium">
                                <ReactMarkdown
                                    components={{
                                        h1: ({ node, ...props }) => <h1 className="text-[18px] font-extrabold text-slate-900 mt-5 mb-2 leading-tight" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-[16px] font-bold text-slate-800 mt-5 mb-2 leading-tight" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-[15px] font-bold text-slate-800 mt-4 mb-2 leading-tight" {...props} />,
                                        strong: ({ node, ...props }) => <strong className="font-bold text-slate-800" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1.5" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1.5" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />
                                    }}
                                >
                                    {viewSummary.text.replace(/^(✅|❌|🔴|⚠️|🟢|🟡|🏥|📋|💊|💡|🔍)(.*)$/gm, '### $1$2')}
                                </ReactMarkdown>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/30 bg-primary/5 rounded-b-[2.5rem] flex-shrink-0"
                             style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
                            <button onClick={() => setViewSummary(null)} className="w-full py-3.5 bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold rounded-[1rem] transition-colors text-[15px] shadow-sm">
                                {t("common.close")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Language Selection Modal */}
            {
                showLanguageModalForDoc && (
                    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="w-full max-w-sm glass-card border border-white/50 rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 size-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                            <div className="flex justify-between items-center mb-5 relative z-10">
                                <h3 className="font-extrabold text-[19px] text-slate-900 flex items-center gap-2"><Globe size={22} className="text-emerald-500 mb-0.5" /> {t("documents.chooseLanguage")}</h3>
                                <button onClick={() => setShowLanguageModalForDoc(null)} className="text-slate-400 hover:text-slate-600 hover:bg-white/50 p-1.5 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            <p className="text-[13px] text-slate-500 font-semibold mb-5 leading-relaxed relative z-10">{t("documents.chooseLanguageDesc")}</p>
                            <select
                                value={summaryLanguage}
                                onChange={(e) => setSummaryLanguage(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-md focus:bg-white/80 focus:ring-2 focus:ring-emerald-500/30 font-bold outline-none mb-6 cursor-pointer text-slate-800 transition-colors shadow-sm relative z-10"
                            >
                                {languages.map(lang => (
                                    <option key={lang.id} value={lang.id}>{t(lang.tKey)}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleGenerateNewSummary}
                                disabled={summarizingDocId !== null}
                                className="w-full py-3.5 bg-emerald-500 text-white hover:bg-emerald-600 font-extrabold rounded-[1.25rem] transition-colors flex items-center justify-center gap-2 shadow-md relative z-10 disabled:opacity-70 disabled:hover:bg-emerald-500"
                            >
                                {summarizingDocId !== null ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                                {t("documents.generateTranslation")}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Add to Timeline Modal */}
            {
                addToTimelineDoc && (
                    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAddToTimelineDoc(null)}>
                        <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2"><Activity size={20} className="text-emerald-500" /> {t("documents.addToTimeline")}</h3>
                                <button onClick={() => setAddToTimelineDoc(null)} className="size-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><X size={18} /></button>
                            </div>
                            <p className="text-[13px] text-slate-500 font-semibold mb-5">{t("documents.linkDocToEvent", { name: addToTimelineDoc.name })}</p>

                            {addToTimelineDone ? (
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 font-bold text-sm">
                                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                                    {addToTimelineDone}
                                </div>
                            ) : (
                                <>
                                    {!selectedEventId && (
                                        <div className="mb-4">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{t("timeline.eventDate")}</label>
                                            <input type="date" value={addToTimelineDate} onChange={e => setAddToTimelineDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none" />
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{t("documents.linkExisting")}</label>
                                        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none">
                                            <option value="">{t("documents.linkNew")}</option>
                                            {lifeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>)}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleAddDocToEvent}
                                        disabled={addingToTimeline}
                                        className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-70 transition-colors"
                                    >
                                        {addingToTimeline ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                                        {selectedEventId ? t("documents.linkToExisting") : t("documents.createNewEvent")}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Edit Document Modal */}
            {editingDoc && (
                <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditingDoc(null)}>
                    <div className="w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl max-h-[88dvh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-[2.5rem] flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Edit2 size={18} className="text-emerald-600" /> {t("documents.editTitle")}</h3>
                            </div>
                            <button onClick={() => setEditingDoc(null)} className="size-9 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-slate-600"><X size={18} /></button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editName")}</label>
                                <input type="text" value={editDocDraft.name} onChange={e => setEditDocDraft({ ...editDocDraft, name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editDate")}</label>
                                    <input type="date" value={editDocDraft.docDate} onChange={e => setEditDocDraft({ ...editDocDraft, docDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editPatient")}</label>
                                    <select value={editDocDraft.patientId} onChange={e => setEditDocDraft({ ...editDocDraft, patientId: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500">
                                        {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editDoctor")}</label>
                                    <input type="text" value={editDocDraft.doctorName} onChange={e => setEditDocDraft({ ...editDocDraft, doctorName: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editHospital")}</label>
                                    <input type="text" value={editDocDraft.hospital} onChange={e => setEditDocDraft({ ...editDocDraft, hospital: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editLab")}</label>
                                    <input type="text" value={editDocDraft.lab} onChange={e => setEditDocDraft({ ...editDocDraft, lab: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                <button 
                                    onClick={() => handleDocDownload(editingDoc)}
                                    disabled={downloadingDocId === editingDoc.id}
                                    className="flex-1 flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors disabled:opacity-60"
                                >
                                    {downloadingDocId === editingDoc.id ? <><Loader2 size={16} className="animate-spin" /> {t("common.downloading")}...</> : <><Download size={16} /> {t("documents.downloadOriginal")}</>}
                                </button>
                            </div>

                            {/* Linked events management in Edit Modal */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t("documents.linkedTimeline")}</p>
                                {(() => {
                                    const linked = globalLifeEvents.filter(e => e.documentIds?.includes(editingDoc.id));
                                    if (linked.length === 0) return <p className="text-xs text-slate-500 font-medium italic">{t("documents.noLinkedEvents")}</p>;
                                    return (
                                        <div className="space-y-2">
                                            {linked.map(ev => (
                                                <div key={ev.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{ev.title}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{ev.date}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleUnlinkDocFromEvent(editingDoc.id, ev.id)}
                                                        disabled={isUnlinking}
                                                        className="size-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 disabled:opacity-50 transition-colors"
                                                        title={t("common.unlink")}
                                                    >
                                                        {isUnlinking ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                                <button
                                    onClick={() => {
                                        setEditingDoc(null);
                                        openAddToTimeline(editingDoc);
                                    }}
                                    className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <Activity size={14} /> {t("documents.linkAnother")}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 border-t flex items-center justify-between bg-slate-50 rounded-b-[2.5rem]">
                            <button
                                onClick={handleDeleteDoc}
                                disabled={isDeletingDoc || isSavingDocEdit}
                                className="px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100 transition-colors flex items-center gap-2"
                            >
                                {isDeletingDoc ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                <span className="hidden sm:inline">{t("common.delete")}</span>
                            </button>

                            <button
                                onClick={handleSaveDocEdit}
                                disabled={isDeletingDoc || isSavingDocEdit}
                                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                {isSavingDocEdit ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {t("common.saveChanges")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Linked Events Management Modal */}
            {viewingLinksDoc && (
                <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewingLinksDoc(null)}>
                    <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 size-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2"><Activity size={20} className="text-violet-500" /> {t("documents.linkedEvents")}</h3>
                            <button onClick={() => setViewingLinksDoc(null)} className="size-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600"><X size={18} /></button>
                        </div>
                        <p className="text-[13px] text-slate-500 font-semibold mb-5">{t("documents.manageLinked", { name: viewingLinksDoc.name })}</p>

                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                            {(() => {
                                const linked = globalLifeEvents.filter(e => e.documentIds?.includes(viewingLinksDoc.id));
                                if (linked.length === 0) return <p className="text-center py-8 text-slate-400 font-bold text-sm">{t("documents.noLinkedEvents")}</p>;
                                return linked.map(ev => (
                                    <div key={ev.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl group hover:border-violet-200 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-extrabold text-slate-800 text-sm truncate">{ev.title}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{ev.date}</p>
                                        </div>
                                        <button
                                            onClick={() => handleUnlinkDocFromEvent(viewingLinksDoc.id, ev.id)}
                                            disabled={isUnlinking}
                                            className="size-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 disabled:opacity-50 transition-colors"
                                            title="Unlink"
                                        >
                                            {isUnlinking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                ));
                            })()}
                        </div>

                        <button
                            onClick={() => {
                                setViewingLinksDoc(null);
                                openAddToTimeline(viewingLinksDoc);
                            }}
                            className="w-full mt-6 py-3.5 bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg active:scale-95"
                        >
                            <Activity size={16} /> {t("documents.linkAnother")}
                        </button>
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
