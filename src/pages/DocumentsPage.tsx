import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { logUserAction } from "@/lib/audit";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { collection, query, where, getDocs, updateDoc, doc as fsDoc, addDoc, serverTimestamp, deleteDoc, onSnapshot } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { FileText, Upload, Loader2, Download, Bot, X, Globe, Activity, Edit2, Trash2, Save, Plus, FolderOpen, MoreVertical, FolderMinus, Lock, Link as LinkIcon, Copy } from "lucide-react";
import { createPortal } from "react-dom";
import { downloadFile } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";
import { useTranslation } from "react-i18next";
import { callGeminiDirect, extractGeminiText } from "@/lib/gemini";
import { encryptUrl } from "@/lib/encryption";

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
    { name: "Imaging (X-ray/MRI)", key: "documents.cat_imagingxraymri", icon: "personal_injury", color: "text-blue-600 bg-blue-50" },
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
    folderId?: string;
    createdAt: { seconds: number } | null;
}

export function DocumentsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { t } = useTranslation();

    // States
    const [docs, setDocs] = useState<Document[]>([]);
    const [patients, setPatients] = useState<{ id: string, name: string, photoURL?: string }[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string>("all");
    const searchQuery = searchParams.get("search") || "";
    const [filterFolder, setFilterFolder] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterEvent, setFilterEvent] = useState<string>("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const [globalLifeEvents, setGlobalLifeEvents] = useState<{ id: string, title?: string, date?: string, documentIds?: string[], folderIds?: string[], doctorName?: string, hospital?: string, lab?: string, category?: string, description?: string, patientId?: string }[]>([]);
    const [viewingLinksDoc, setViewingLinksDoc] = useState<Document | null>(null);
    const [isUnlinking, setIsUnlinking] = useState(false);

    // Document Edit State
    const [editingDoc, setEditingDoc] = useState<Document | null>(null);
    const [editDocDraft, setEditDocDraft] = useState({ name: "", docDate: "", patientId: "", doctorName: "", hospital: "", lab: "", category: "" });
    const [isSavingDocEdit, setIsSavingDocEdit] = useState(false);
    const [isDeletingDoc, setIsDeletingDoc] = useState(false);

    // Organization States
    const [viewMode, setViewMode] = useState<"list" | "dashboard" | "timeline" | "folder">("list");
    const [viewingFolderId, setViewingFolderId] = useState<string | null>(null);
    const [timelineFilterCategory, setTimelineFilterCategory] = useState<string | null>(null);
    const [timelineFilterFolderId, setTimelineFilterFolderId] = useState<string | null>(null);
    const [folders, setFolders] = useState<{ id: string, name: string, patientId?: string }[]>([]);

    // Modals state
    const [viewSummary, setViewSummary] = useState<{ text: string, lang: string } | null>(null);
    const [showLanguageModalForDoc, setShowLanguageModalForDoc] = useState<Document | null>(null);
    const [summaryLanguage, setSummaryLanguage] = useState(t("common.localeCode") === "hi-IN" ? "Hindi" : "English");
    const [summarizingDocId, setSummarizingDocId] = useState<string | null>(null);
    const [_generationProgress, setGenerationProgress] = useState<string>("");

    // Add to Timeline state
    const [addToTimelineDoc, setAddToTimelineDoc] = useState<Document | null>(null);
    const [addToTimelineFolder, setAddToTimelineFolder] = useState<{ id: string, name: string, patientId?: string } | null>(null);
    const [addToTimelineDate, setAddToTimelineDate] = useState("");
    const [lifeEvents, setLifeEvents] = useState<{ id: string, title: string, date: string, patientId: string }[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [addingToTimeline, setAddingToTimeline] = useState(false);
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
    const [addToTimelineDone, setAddToTimelineDone] = useState<string | null>(null);

    // Viewer State
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerData, setViewerData] = useState({ url: "", title: "", type: "" });

    // Create Folder State
    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    // Rename Folder State
    const [renamingFolder, setRenamingFolder] = useState<{ id: string, name: string } | null>(null);
    const [renameFolderName, setRenameFolderName] = useState('');

    // Delete Folder State
    const [deletingFolder, setDeletingFolder] = useState<{ id: string, name: string } | null>(null);
    const [deleteFolderDocs, setDeleteFolderDocs] = useState(false);
    const [isDeletingFolder, setIsDeletingFolder] = useState(false);

    // Doc Move State
    const [moveDocId, setMoveDocId] = useState<string | null>(null);

    // Doc Actions Menu
    const [activeDocMenu, setActiveDocMenu] = useState<string | null>(null);

    // Timeline Event Modal State
    const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventDraft, setEventDraft] = useState({ title: "", category: "visit", date: "", description: "", documentIds: [] as string[], folderIds: [] as string[], doctorName: "", hospital: "", lab: "" });
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [addDocToEventId, setAddDocToEventId] = useState<string | null>(null);

    // Share State
    const [shareDoc, setShareDoc] = useState<Document | null>(null);
    const [shareExpiry, setShareExpiry] = useState("24h");
    const [sharePin, setSharePin] = useState("");
    const [isSharing, setIsSharing] = useState(false);
    const [sharedLink, setSharedLink] = useState("");
    const [allSharedLinks, setAllSharedLinks] = useState<any[]>([]);

    // Custom search event removed as it is now handled by GlobalSearchModal

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "patients"), where("userId", "==", user.uid));
        const unsub = onSnapshot(q, (snap: any) => {
            setAllSharedLinks(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [user]);

    const handleRevokeShare = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this secure link? It will stop working immediately.")) return;
        try {
            await deleteDoc(fsDoc(db, "shared_links", id));
        } catch (e) {
            console.error("Failed to revoke share", e);
        }
    };

    const renderSharedLinksForDoc = (docId: string) => {
        const links = allSharedLinks.filter(l => l.documentId === docId);
        if (links.length === 0) return null;
        return (
            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100 w-full">
                {links.map(link => {
                    const isExpired = new Date(link.expiresAt?.toDate() || 0) < new Date();
                    return (
                        <div key={link.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg p-2 group min-w-0" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2 min-w-0 mr-2">
                                <LinkIcon size={12} className="text-emerald-500 shrink-0" />
                                <span className="text-[10px] font-bold text-emerald-700 truncate">
                                    {isExpired ? "Expired Link" : "Active Secure Link"}
                                    {link.hasPin && " (PIN protected)"}
                                </span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleRevokeShare(link.id); }} className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md hover:bg-rose-200 transition-colors">
                                Revoke
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Global click listener to close menu
    useEffect(() => {
        const handleClickOutside = () => setActiveDocMenu(null);
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // Initial setup from URL params
    useEffect(() => {
        const fetchPatients = async () => {
            if (!user) return;
            const snap = await getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)));
            const pts = snap.docs.map(d => ({ id: d.id, name: d.data().name, photoURL: d.data().photoURL }));
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
                    documentIds: d.data().documentIds || [],
                    folderIds: d.data().folderIds || [],
                    doctorName: d.data().doctorName,
                    hospital: d.data().hospital,
                    lab: d.data().lab,
                    category: d.data().category,
                    description: d.data().description,
                    patientId: d.data().patientId
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
            lab: doc.lab || "",
            category: doc.category || ""
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
                lab: editDocDraft.lab,
                category: editDocDraft.category || null
            });
            setDocs(docs.map(d => d.id === editingDoc.id ? { ...d, name: editDocDraft.name, docDate: editDocDraft.docDate, patientId: editDocDraft.patientId, doctorName: editDocDraft.doctorName, hospital: editDocDraft.hospital, lab: editDocDraft.lab, category: editDocDraft.category || undefined } : d));
            setEditingDoc(null);
        } catch (e) {
            console.error("Failed to update doc:", e);
            alert(t("documents.saveError"));
        } finally {
            setIsSavingDocEdit(false);
        }
    };

    const handleSaveEvent = async () => {
        if (!user) return;
        if (!eventDraft.title.trim()) {
            alert("Title is required");
            return;
        }
        setIsSavingEvent(true);
        try {
            const eventData = {
                title: eventDraft.title.trim(),
                category: eventDraft.category,
                date: eventDraft.date,
                description: eventDraft.description.trim(),
                documentIds: eventDraft.documentIds,
                doctorName: eventDraft.doctorName.trim(),
                hospital: eventDraft.hospital.trim(),
                lab: eventDraft.lab.trim(),
                userId: user.uid,
                patientId: selectedPatientId,
                updatedAt: new Date()
            };

            if (editingEventId) {
                await updateDoc(fsDoc(db, "life_events", editingEventId), eventData);
                setGlobalLifeEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, ...eventData, id: editingEventId } : e));
            } else {
                const docRef = await addDoc(collection(db, "life_events"), {
                    ...eventData,
                    createdAt: new Date()
                });
                setGlobalLifeEvents(prev => [{ ...eventData, id: docRef.id, createdAt: new Date() }, ...prev]);
            }
            setCreateEventModalOpen(false);
        } catch (e) {
            console.error("Error saving event:", e);
            alert("Failed to save event");
        } finally {
            setIsSavingEvent(false);
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
            // Check if any other doc uses the same URL
            const docsWithSameUrl = docs.filter(d => d.url === editingDoc.url);
            if (docsWithSameUrl.length <= 1) {
                // Delete from storage
                const fileRef = ref(storage, `documents/${user.uid}/${editingDoc.id}_${editingDoc.name}`);
                try { await deleteObject(fileRef); } catch (e) { console.warn("Storage delete failed/skipped", e); }
            }

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

    const handleQuickDeleteDoc = async (docObj: Document) => {
        if (!user) return;
        if (!confirm(t("documents.deleteConfirm"))) return;
        try {
            const docsWithSameUrl = docs.filter(d => d.url === docObj.url);
            if (docsWithSameUrl.length <= 1) {
                const fileRef = ref(storage, `documents/${user.uid}/${docObj.id}_${docObj.name}`);
                try { await deleteObject(fileRef); } catch (e) { console.warn("Storage delete skipped", e); }
            }
            await deleteDoc(fsDoc(db, "documents", docObj.id));
            await logUserAction(user.uid, "DOCUMENT_DELETED", `User deleted document: ${docObj.name}`, { docId: docObj.id });
            setDocs(prevDocs => prevDocs.filter(d => d.id !== docObj.id));
        } catch (e) {
            console.error("Failed to delete doc:", e);
            alert(t("documents.deleteError"));
        }
    };

    // Fetch folders for user — scoped by selectedPatientId
    useEffect(() => {
        if (user && selectedPatientId !== 'all') {
            getDocs(query(collection(db, "folders"), where("userId", "==", user.uid), where("patientId", "==", selectedPatientId)))
                .then(snap => setFolders(snap.docs.map(d => ({ id: d.id, name: d.data().name, patientId: d.data().patientId }))));
        } else {
            setFolders([]);
        }
    }, [user, selectedPatientId]);

    // Handle Search filter locally
    const filteredDocs = useMemo(() => {
        let currentDocs = docs;

        if (viewMode === "timeline") {
            if (timelineFilterCategory) {
                currentDocs = currentDocs.filter(d => d.category === timelineFilterCategory || d.docType === timelineFilterCategory);
            } else if (timelineFilterFolderId) {
                currentDocs = currentDocs.filter(d => d.folderId === timelineFilterFolderId);
            }
        }

        // Apply new rich filters
        if (filterFolder !== "all") {
            currentDocs = currentDocs.filter(d => d.folderId === filterFolder);
        }
        if (filterCategory !== "all") {
            currentDocs = currentDocs.filter(d => d.category === filterCategory);
        }
        if (filterType !== "all") {
            currentDocs = currentDocs.filter(d => d.type.startsWith(filterType));
        }
        if (filterEvent !== "all") {
            const event = globalLifeEvents.find(e => e.id === filterEvent);
            if (event) {
                currentDocs = currentDocs.filter(d => event.documentIds?.includes(d.id));
            }
        }

        const query = searchQuery.trim().toLowerCase();
        if (query) {
            currentDocs = currentDocs.filter(d =>
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
        }

        // Apply sorting
        return currentDocs.sort((a, b) => {
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now();
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.now();
            return sortBy === "newest" ? dateB - dateA : dateA - dateB;
        });
    }, [docs, searchQuery, viewMode, timelineFilterCategory, timelineFilterFolderId, filterFolder, filterCategory, filterEvent, filterType, sortBy, globalLifeEvents]);

    const handlePatientChange = (val: string) => {
        setSelectedPatientId(val);
        const params = new URLSearchParams(searchParams);
        if (val && val !== "all") {
            params.set("patientId", val);
        } else {
            params.delete("patientId");
        }
        setViewMode("list");
        setTimelineFilterCategory(null);
        setTimelineFilterFolderId(null);
        setSearchParams(params, { replace: true });
    };


    const openFolderTimeline = (folderId: string) => {
        setViewingFolderId(folderId);
        setViewMode("folder");
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
                    setGlobalLifeEvents(prev => prev.map(e => e.id === selectedEventId ? { ...e, documentIds: [...(e.documentIds || []), addToTimelineDoc.id] } : e));
                }
                
                // Sync document date to the event date
                const evDate = existingEvent?.data().date;
                if (evDate && evDate !== addToTimelineDoc.docDate && evDate !== addToTimelineDoc.eventDate) {
                    await updateDoc(fsDoc(db, "documents", addToTimelineDoc.id), { eventDate: evDate });
                    setDocs(docs.map(d => d.id === addToTimelineDoc.id ? { ...d, eventDate: evDate } : d));
                }
                
                setAddToTimelineDone(t("documents.linkSuccess"));
            } else {
                // Create a new event with this doc linked
                const newEventDate = addToTimelineDate || addToTimelineDoc.docDate || new Date().toISOString().split('T')[0];
                const newDocRef = await addDoc(collection(db, "life_events"), {
                    userId: user.uid,
                    patientId: addToTimelineDoc.patientId,
                    title: addToTimelineDoc.name.replace(/\.[^/.]+$/, ""),
                    category: "visit",
                    date: newEventDate,
                    description: "",
                    documentIds: [addToTimelineDoc.id],
                    createdAt: serverTimestamp()
                });
                
                const newEventObj = {
                    id: newDocRef.id,
                    userId: user.uid,
                    patientId: addToTimelineDoc.patientId,
                    title: addToTimelineDoc.name.replace(/\.[^/.]+$/, ""),
                    category: "visit",
                    date: newEventDate,
                    documentIds: [addToTimelineDoc.id]
                };
                setGlobalLifeEvents(prev => [...prev, newEventObj]);
                setLifeEvents(prev => [...prev, newEventObj]);
                
                // Sync document date to the new event date
                if (newEventDate && newEventDate !== addToTimelineDoc.docDate && newEventDate !== addToTimelineDoc.eventDate) {
                    await updateDoc(fsDoc(db, "documents", addToTimelineDoc.id), { eventDate: newEventDate });
                    setDocs(docs.map(d => d.id === addToTimelineDoc.id ? { ...d, eventDate: newEventDate } : d));
                }
                
                setAddToTimelineDone(t("documents.createSuccess"));
            }
        } catch (e) {
            console.error(e);
            alert(t("documents.addTimelineError"));
        } finally {
            setAddingToTimeline(false);
        }
    };

    const openFolderAddToTimeline = async (folder: { id: string, name: string, patientId?: string }) => {
        setAddToTimelineFolder(folder);
        setSelectedEventId("");
        setAddToTimelineDone(null);
        setAddToTimelineDate(new Date().toISOString().split('T')[0]);
        // Fetch existing events for this folder's patient
        if (folder.patientId && user) {
            const snap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid), where("patientId", "==", folder.patientId)));
            setLifeEvents(snap.docs.map(d => ({ id: d.id, title: d.data().title, date: d.data().date, patientId: d.data().patientId })));
        } else if (user) {
            const snap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
            setLifeEvents(snap.docs.map(d => ({ id: d.id, title: d.data().title, date: d.data().date, patientId: d.data().patientId })));
        }
    };

    const handleAddFolderToEvent = async () => {
        if (!addToTimelineFolder || !user) return;
        setAddingToTimeline(true);
        try {
            if (selectedEventId) {
                // Link folder to existing event
                const eventRef = fsDoc(db, "life_events", selectedEventId);
                const eventSnap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
                const existingEvent = eventSnap.docs.find(d => d.id === selectedEventId);
                const existingIds: string[] = existingEvent?.data().folderIds || [];
                if (!existingIds.includes(addToTimelineFolder.id)) {
                    await updateDoc(eventRef, { folderIds: [...existingIds, addToTimelineFolder.id] });
                    setGlobalLifeEvents(prev => prev.map(e => e.id === selectedEventId ? { ...e, folderIds: [...(e.folderIds || []), addToTimelineFolder.id] } : e));
                }
                
                setAddToTimelineDone(t("documents.linkSuccess"));
            } else {
                // Create a new event with this folder linked
                const newEventDate = addToTimelineDate || new Date().toISOString().split('T')[0];
                const newDocRef = await addDoc(collection(db, "life_events"), {
                    userId: user.uid,
                    patientId: addToTimelineFolder.patientId,
                    title: addToTimelineFolder.name,
                    category: "visit",
                    date: newEventDate,
                    description: "",
                    folderIds: [addToTimelineFolder.id],
                    createdAt: serverTimestamp()
                });
                
                const newEventObj = {
                    id: newDocRef.id,
                    userId: user.uid,
                    patientId: addToTimelineFolder.patientId,
                    title: addToTimelineFolder.name,
                    category: "visit",
                    date: newEventDate,
                    folderIds: [addToTimelineFolder.id]
                };
                setGlobalLifeEvents(prev => [...prev, newEventObj]);
                setLifeEvents(prev => [...prev, { id: newEventObj.id, title: newEventObj.title, date: newEventObj.date, patientId: newEventObj.patientId || "" }]);
                
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
            const result = await callGeminiDirect({
                contents: [{
                    role: "user",
                    parts: [
                        { text: `${TRANSLATION_PROMPT(lang)}\n\nOriginal Summary:\n${sourceText}` }
                    ]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
            });
            const newSummary = extractGeminiText(result);

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

        } catch (error: any) {
            console.error("Error generating summary:", error);
            alert("Failed to generate summary. Please try again.");
        } finally {
            setSummarizingDocId(null);
            setGenerationProgress("");
        }
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newFolderName.trim() || selectedPatientId === 'all') return;
        try {
            const docRef = await addDoc(collection(db, "folders"), {
                userId: user.uid,
                name: newFolderName.trim(),
                patientId: selectedPatientId,
                createdAt: serverTimestamp()
            });
            setFolders([...folders, { id: docRef.id, name: newFolderName.trim(), patientId: selectedPatientId }]);
            setNewFolderName("");
            setCreateFolderModalOpen(false);
        } catch (err) {
            console.error("Error creating folder:", err);
            alert("Failed to create folder. Please try again.");
        }
    };

    const handleRenameFolder = async () => {
        if (!renamingFolder || !renameFolderName.trim()) return;
        try {
            await updateDoc(fsDoc(db, 'folders', renamingFolder.id), { name: renameFolderName.trim() });
            setFolders(folders.map(f => f.id === renamingFolder.id ? { ...f, name: renameFolderName.trim() } : f));
            setRenamingFolder(null);
        } catch (err) {
            console.error('Failed to rename folder:', err);
            alert('Failed to rename folder.');
        }
    };

    const handleDeleteFolder = async () => {
        if (!deletingFolder || !user) return;
        setIsDeletingFolder(true);
        try {
            if (deleteFolderDocs) {
                // Delete all documents in this folder
                const folderDocs = docs.filter(d => d.folderId === deletingFolder.id);
                for (const doc of folderDocs) {
                    const docsWithSameUrl = docs.filter(d => d.url === doc.url);
                    if (docsWithSameUrl.length <= 1) {
                        const fileRef = ref(storage, `documents/${user.uid}/${doc.id}_${doc.name}`);
                        try { await deleteObject(fileRef); } catch (e) { console.warn('Storage delete skipped', e); }
                    }
                    await deleteDoc(fsDoc(db, 'documents', doc.id));
                }
                setDocs(docs.filter(d => d.folderId !== deletingFolder.id));
            } else {
                // Just unfolder the documents (set folderId to null)
                const folderDocs = docs.filter(d => d.folderId === deletingFolder.id);
                for (const doc of folderDocs) {
                    await updateDoc(fsDoc(db, 'documents', doc.id), { folderId: null });
                }
                setDocs(docs.map(d => d.folderId === deletingFolder.id ? { ...d, folderId: undefined } : d));
            }
            // Delete the folder itself
            await deleteDoc(fsDoc(db, 'folders', deletingFolder.id));
            setFolders(folders.filter(f => f.id !== deletingFolder.id));
            setDeletingFolder(null);
            setDeleteFolderDocs(false);
        } catch (err) {
            console.error('Failed to delete folder:', err);
            alert('Failed to delete folder.');
        } finally {
            setIsDeletingFolder(false);
        }
    };

    const handleDuplicateDoc = async (docObj: Document) => {
        if (!user) return;
        try {
            const newName = `Copy of ${docObj.name}`;
            const newDoc = {
                userId: user.uid,
                patientId: docObj.patientId,
                name: newName,
                type: docObj.type,
                url: docObj.url,
                docType: docObj.docType || "",
                docDate: docObj.docDate || "",
                doctorName: docObj.doctorName || "",
                hospital: docObj.hospital || "",
                lab: docObj.lab || "",
                category: docObj.category || "",
                folderId: docObj.folderId || null,
                createdAt: serverTimestamp(),
            };
            const added = await addDoc(collection(db, "documents"), newDoc);
            await logUserAction(user.uid, "DOCUMENT_DUPLICATED", `User duplicated document: ${docObj.name}`);
            setDocs(prev => [{...docObj, ...newDoc, id: added.id, createdAt: {seconds: Date.now() / 1000}} as any, ...prev]);
        } catch(e) {
            console.error("Failed to duplicate doc", e);
            alert("Failed to duplicate document.");
        }
    };

    const handleDuplicateFolder = async (folderObj: { id: string, name: string, patientId?: string }) => {
        if (!user) return;
        try {
            const newName = `Copy of ${folderObj.name}`;
            const addedFolder = await addDoc(collection(db, 'folders'), {
                userId: user.uid,
                patientId: folderObj.patientId || null,
                name: newName,
                createdAt: serverTimestamp()
            });
            const newFolderObj = { id: addedFolder.id, name: newName, patientId: folderObj.patientId };
            setFolders(prev => [newFolderObj, ...prev]);

            // Duplicate all docs in this folder
            const folderDocs = docs.filter(d => d.folderId === folderObj.id);
            for (const docObj of folderDocs) {
                const newDocName = `Copy of ${docObj.name}`;
                const newDoc = {
                    userId: user.uid,
                    patientId: docObj.patientId,
                    name: newDocName,
                    type: docObj.type,
                    url: docObj.url,
                    docType: docObj.docType || "",
                    docDate: docObj.docDate || "",
                    doctorName: docObj.doctorName || "",
                    hospital: docObj.hospital || "",
                    lab: docObj.lab || "",
                    category: docObj.category || "",
                    folderId: addedFolder.id,
                    createdAt: serverTimestamp(),
                };
                const addedDoc = await addDoc(collection(db, "documents"), newDoc);
                setDocs(prev => [{...docObj, ...newDoc, id: addedDoc.id, createdAt: {seconds: Date.now() / 1000}} as any, ...prev]);
            }
            await logUserAction(user.uid, "FOLDER_DUPLICATED", `User duplicated folder: ${folderObj.name}`);
        } catch(e) {
            console.error("Failed to duplicate folder", e);
            alert("Failed to duplicate folder.");
        }
    };

    const handleDuplicateEvent = async (eventObj: { id: string, title?: string, date?: string, documentIds?: string[], folderIds?: string[], doctorName?: string, hospital?: string, lab?: string, category?: string, description?: string, patientId?: string }) => {
        if (!user) return;
        try {
            const newTitle = `Copy of ${eventObj.title || 'Event'}`;
            const newEvent = {
                userId: user.uid,
                patientId: eventObj.patientId || null,
                title: newTitle,
                date: eventObj.date || "",
                category: eventObj.category || "visit",
                description: eventObj.description || "",
                documentIds: eventObj.documentIds || [],
                folderIds: eventObj.folderIds || [],
                doctorName: eventObj.doctorName || "",
                hospital: eventObj.hospital || "",
                lab: eventObj.lab || "",
                createdAt: serverTimestamp()
            };
            const added = await addDoc(collection(db, "life_events"), newEvent);
            const newEventLocal = { id: added.id, ...newEvent, patientId: newEvent.patientId === null ? undefined : newEvent.patientId };
            setGlobalLifeEvents(prev => [...prev, newEventLocal]);
            setLifeEvents(prev => [...prev, { id: added.id, title: newTitle, date: newEvent.date, patientId: newEvent.patientId || "" }]);
            await logUserAction(user.uid, "EVENT_DUPLICATED", `User duplicated event: ${eventObj.title}`);
        } catch(e) {
            console.error("Failed to duplicate event", e);
            alert("Failed to duplicate event.");
        }
    };

    const handleShareDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shareDoc || !user) return;
        
        setIsSharing(true);
        try {
            const hasPin = sharePin.trim().length === 4;
            let encryptedUrl = "";
            let rawUrl = "";
            
            if (hasPin) {
                encryptedUrl = encryptUrl(shareDoc.url, sharePin.trim());
            } else {
                // If no PIN is selected, we could either enforce a PIN or just store the URL plainly.
                // Let's store rawUrl, or encrypt with a default empty PIN, or whatever our SharedView does.
                // Let's just pass `rawUrl = shareDoc.url` when `hasPin === false` to support no-pin access if allowed.
                rawUrl = shareDoc.url;
            }

            const now = new Date();
            let expiryDate = new Date(now);
            if (shareExpiry === "15m") expiryDate.setMinutes(now.getMinutes() + 15);
            else if (shareExpiry === "1h") expiryDate.setHours(now.getHours() + 1);
            else if (shareExpiry === "24h") expiryDate.setHours(now.getHours() + 24);
            else if (shareExpiry === "7d") expiryDate.setDate(now.getDate() + 7);
            else if (shareExpiry === "30d") expiryDate.setDate(now.getDate() + 30);

            const shareData = {
                userId: user.uid,
                documentId: shareDoc.id,
                documentName: shareDoc.name,
                hasPin,
                encryptedUrl: hasPin ? encryptedUrl : null,
                url: !hasPin ? rawUrl : null,
                expiresAt: expiryDate,
                createdAt: serverTimestamp()
            };

            const shareRef = await addDoc(collection(db, "shared_links"), shareData);
            
            const fullLink = `${window.location.origin}/share/${shareRef.id}`;
            setSharedLink(fullLink);
            
            await logUserAction(user.uid, "DOCUMENT_SHARED", `User shared document securely: ${shareDoc.name}`);
        } catch (e) {
            console.error("Share failed", e);
            alert("Failed to create secure link.");
        } finally {
            setIsSharing(false);
        }
    };

    const handleDeleteEvent = async (eventObj: { id: string, title?: string }) => {
        if (!user) return;
        if (window.confirm(`Are you sure you want to delete '${eventObj.title || 'this event'}'?`)) {
            try {
                await deleteDoc(fsDoc(db, "life_events", eventObj.id));
                setGlobalLifeEvents(prev => prev.filter(e => e.id !== eventObj.id));
                setLifeEvents(prev => prev.filter(e => e.id !== eventObj.id));
            } catch(e) {
                console.error("Failed to delete event", e);
                alert("Failed to delete event.");
            }
        }
    };

    const selectedPatientName = patients.find(p => p.id === selectedPatientId)?.name || "";

    const renderCategory = (cat: string) => {
        if (!cat) return null;
        let safeCat = cat.replace('documents.cat_', '').replace(/^cat_/, '').toLowerCase().replace(/[^a-z]/g, '');
        return t(`documents.cat_${safeCat}`);
    };

    const renderDocumentCard = (doc: Document) => {
        const patient = patients.find(p => p.id === doc.patientId);
        return (
            <div key={doc.id} className="glass-card rounded-2xl p-3 flex gap-3 items-start shadow-sm border border-white/40 hover:shadow-md hover:border-primary/30 transition-all group">
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
                        {doc.category && (
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 rounded-md">
                                {renderCategory(doc.category)}
                            </span>
                        )}
                        {patient && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
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

                    {/* AI Summary buttons */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                        {doc.aiSummaries && Object.keys(doc.aiSummaries).length > 0 ? (
                            Object.entries(doc.aiSummaries).map(([l, text]) => (
                                <button key={l} onClick={() => setViewSummary({ text: text as string, lang: l })} className="text-[10px] font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 px-2 py-1 flex items-center gap-1 rounded-lg transition-colors">
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
                            <button onClick={() => setShowLanguageModalForDoc(doc)} disabled={summarizingDocId === doc.id} className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 flex items-center gap-1 rounded-lg transition-colors disabled:opacity-50">
                                {summarizingDocId === doc.id ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
                                {summarizingDocId === doc.id ? "..." : t("common.translate")}
                            </button>
                        )}
                    </div>
                    
                    {/* Active Shares */}
                    {renderSharedLinksForDoc(doc.id)}
                </div>

                {/* Action column */}
                <div className="flex flex-col gap-1.5 flex-shrink-0 relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setActiveDocMenu(activeDocMenu === doc.id ? null : doc.id); }} 
                        className="size-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors" 
                        title="More Actions"
                    >
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>
        );
    };

    if (!user) return null;

    return (
        <div className="pb-6 w-full max-w-lg mx-auto space-y-6 relative px-4 overflow-x-hidden">
            <div className="fixed top-0 left-0 right-0 h-[50vh] soft-gradient-bg -z-10 pointer-events-none"></div>
            <div className="flex items-center justify-between pt-6">
                <h1 className="text-xl font-bold">Document Vault</h1>
                {selectedPatientId !== 'all' && (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-xl font-medium cursor-pointer shadow-sm hover:bg-primary/90 transition-colors flex-shrink-0 min-h-[44px]"
                    >
                        <Upload size={16} />
                        <span className="hidden xs:inline">{t("documents.upload")}</span>
                    </button>
                )}
            </div>

            {/* Landing State: Select a family member */}
            {selectedPatientId === 'all' && (
                <>

                    {/* Family Member Cards */}
                    {patients.length > 0 ? (
                        <div className="space-y-4">
                            <div className="text-center py-4 space-y-4">
                                <div>
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">folder_shared</span>
                                    <p className="font-bold text-slate-700 text-[15px]">Select a family member to view their documents</p>
                                </div>
                                <button
                                    onClick={() => navigate('/timeline')}
                                    className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors shadow-sm"
                                >
                                    <Activity size={16} /> View Global Life Timeline
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {patients.map(p => {
                                    const docCount = docs.filter(d => d.patientId === p.id).length;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => handlePatientChange(p.id)}
                                            className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[1.5rem] px-5 py-5 flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-center group"
                                        >
                                            <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform overflow-hidden border border-blue-100 shadow-sm">
                                                {p.photoURL ? (
                                                    <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[32px]">person</span>
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-[15px] font-extrabold text-slate-800 block line-clamp-1">{p.name}</span>
                                                <span className="text-[12px] font-bold text-slate-500">{docCount} Documents</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="glass-card text-center p-12 text-slate-500 rounded-[2rem] border border-white/40 shadow-sm mt-4">
                            <span className="material-symbols-outlined text-4xl opacity-30 block mb-3">group</span>
                            <p className="font-bold text-foreground">No family members added yet.</p>
                            <p className="text-sm mt-1 max-w-xs mx-auto">Go to Patients to add one.</p>
                        </div>
                    )}
                </>
            )}

            {/* Patient Selected State */}
            {selectedPatientId !== 'all' && (
                <>
                    {/* Back button + Patient header */}
                    <div className="space-y-2 min-w-0">
                        <button
                            onClick={() => handlePatientChange('all')}
                            className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            <span className="text-lg">←</span> All Members
                        </button>
                        <h2 className="text-[19px] font-extrabold text-slate-900 truncate" title={`${selectedPatientName}'s Documents`}>{selectedPatientName}'s Documents</h2>
                    </div>

                    {/* Filter & Sort Bar */}
                    <div className="flex justify-between items-center mb-4">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${showFilters ? 'bg-primary text-white border-primary shadow-md' : 'bg-white/60 border-white/40 text-slate-600 hover:bg-white/80 shadow-sm'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            Filter & Sort
                        </button>
                    </div>

                    {showFilters && (
                        <div className="glass-card rounded-2xl p-4 shadow-sm border border-white/40 mb-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-in slide-in-from-top-2 duration-200">
                                <select value={filterFolder} onChange={e => setFilterFolder(e.target.value)} className="px-4 py-3 rounded-xl border border-white/40 bg-white/60 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                    <option value="all">All Folders</option>
                                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                
                                <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="px-4 py-3 rounded-xl border border-white/40 bg-white/60 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                    <option value="all">All Events</option>
                                    {globalLifeEvents.filter(e => e.patientId === selectedPatientId).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                                </select>

                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-4 py-3 rounded-xl border border-white/40 bg-white/60 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                    <option value="all">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c.name} value={c.name}>{t(c.key)}</option>)}
                                </select>

                                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-3 rounded-xl border border-white/40 bg-white/60 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                    <option value="all">All File Types</option>
                                    <option value="image/">Images</option>
                                    <option value="application/pdf">PDFs</option>
                                </select>

                                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-4 py-3 rounded-xl border border-white/40 bg-white/60 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                    <option value="newest">Sort: Newest First</option>
                                    <option value="oldest">Sort: Oldest First</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* View Toggles */}
                    {!loading && (
                        <div className="flex bg-white/40 backdrop-blur-md border border-white/40 p-1.5 rounded-[1.25rem] shadow-sm mt-2 relative z-10 w-full mb-4">
                            {/* Icon-only on small screens, icon+label on sm+ */}
                            <button
                                onClick={() => { setViewMode("list"); setTimelineFilterCategory(null); setTimelineFilterFolderId(null); }}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] ${viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"}`}
                            >
                                <span className="material-symbols-outlined text-[20px]">list</span>
                                <span className="hidden sm:inline">{t("documents.viewList")}</span>
                            </button>
                            <button
                                onClick={() => { setViewMode("dashboard"); setTimelineFilterCategory(null); setTimelineFilterFolderId(null); }}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] ${viewMode === "dashboard" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"}`}
                            >
                                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                                <span className="hidden sm:inline">Folders</span>
                            </button>
                            <button
                                onClick={() => { setViewMode("timeline"); setTimelineFilterCategory(null); setTimelineFilterFolderId(null); }}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] ${viewMode === "timeline" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/20"}`}
                            >
                                <span className="material-symbols-outlined text-[20px]">timeline</span>
                                <span className="hidden sm:inline">Events</span>
                            </button>
                        </div>
                    )}

                    {/* Smart Dashboard View */}
                    {viewMode === "dashboard" && !loading && (
                        <div className="space-y-6">
                            {/* Folders Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-[17px] font-extrabold text-slate-900 ml-1">{selectedPatientName}'s Folders</h2>
                                    <button onClick={() => setCreateFolderModalOpen(true)} className="text-blue-600 text-[13px] font-bold flex items-center gap-1 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg">
                                        <Plus size={16} /> New Folder
                                    </button>
                                </div>
                                {folders.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {folders.map(folder => {
                                            const count = docs.filter(d => d.folderId === folder.id).length;
                                            return (
                                                <div
                                                    key={folder.id}
                                                    className="bg-white/60 backdrop-blur-md border border-white/60 rounded-[1.5rem] px-5 py-4 flex flex-col items-start gap-3 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all text-left group relative"
                                                >
                                                    <button
                                                        onClick={() => openFolderTimeline(folder.id)}
                                                        className="absolute inset-0 z-0 rounded-[1.5rem]"
                                                        aria-label={`Open folder ${folder.name}`}
                                                    />
                                                    <div className="flex items-center justify-between w-full relative z-10">
                                                        <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                                            <span className="material-symbols-outlined text-[20px]">folder</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openFolderAddToTimeline(folder); }}
                                                                className="size-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                                title="Add to Event"
                                                            >
                                                                <Activity size={13} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDuplicateFolder(folder); }}
                                                                className="size-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors"
                                                                title="Duplicate Folder"
                                                            >
                                                                <Save size={13} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder); setRenameFolderName(folder.name); }}
                                                                className="size-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                                                title="Rename"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setDeletingFolder(folder); setDeleteFolderDocs(false); }}
                                                                className="size-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="relative z-10">
                                                        <span className="text-[15px] font-extrabold text-slate-800 block line-clamp-1">{folder.name}</span>
                                                        <span className="text-[12px] font-bold text-slate-500">{count} Files</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-400">
                                        <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm font-semibold">No folders yet. Create one to organize documents.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timeline View */}
                    {viewMode === "timeline" && !loading && (
                        <div className="space-y-6 mt-4 relative">
                            {/* "New Event" button */}
                            <div className="flex justify-between items-center mb-4 min-w-0 gap-2">
                                <h2 className="text-[17px] font-extrabold text-slate-900 ml-1 truncate" title={`${selectedPatientName}'s Timeline`}>{selectedPatientName}'s Timeline</h2>
                                <button onClick={() => { 
                                    setEditingEventId(null); 
                                    setEventDraft({ title: "", category: "visit", date: new Date().toISOString().split('T')[0], description: "", documentIds: [], folderIds: [], doctorName: "", hospital: "", lab: "" });
                                    setCreateEventModalOpen(true); 
                                }} className="text-blue-600 text-[13px] font-bold flex items-center gap-1 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg">
                                    <Plus size={16} /> New Event
                                </button>
                            </div>

                            {globalLifeEvents.filter(e => e.patientId === selectedPatientId).length === 0 ? (
                                <div className="glass-card text-center p-12 text-slate-500 rounded-[2rem] border border-white/40 shadow-sm mt-4">
                                    <span className="material-symbols-outlined text-4xl opacity-30 block mb-3">timeline</span>
                                    <p className="font-bold text-foreground">No events yet.</p>
                                    <p className="text-sm mt-1 max-w-xs mx-auto">Create an event to start building the timeline.</p>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 py-2">
                                    {globalLifeEvents.filter(e => e.patientId === selectedPatientId).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).map(event => {
                                        const renderDate = new Date(event.date || Date.now()).toLocaleDateString(t("common.localeCode"), { month: 'short', day: 'numeric', year: 'numeric' });
                                        return (
                                            <div key={event.id} className="relative pl-6 group">
                                                {/* Timeline Node */}
                                                <div className="absolute w-4 h-4 bg-primary/40 group-hover:bg-primary transition-colors rounded-full -left-[9px] top-4 border-4 border-[#f0f4f8] shadow-sm" />
                                                
                                                <div className="glass-card rounded-[1.25rem] p-4 shadow-sm border border-white/50 hover:shadow-md hover:border-primary/30 transition-all">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[11px] font-extrabold text-primary uppercase tracking-wider">{renderDate}</span>
                                                        <div className="flex items-center gap-1">
                                                            <button 
                                                                onClick={() => setAddDocToEventId(event.id)}
                                                                className="size-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
                                                                title="Add Document"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDuplicateEvent(event)}
                                                                className="size-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors"
                                                                title="Duplicate Event"
                                                            >
                                                                <Save size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingEventId(event.id);
                                                                    setEventDraft({
                                                                        title: event.title || "",
                                                                        category: event.category || "visit",
                                                                        date: event.date || "",
                                                                        description: event.description || "",
                                                                        documentIds: event.documentIds || [],
                                                                        folderIds: event.folderIds || [],
                                                                        doctorName: event.doctorName || "",
                                                                        hospital: event.hospital || "",
                                                                        lab: event.lab || ""
                                                                    });
                                                                    setCreateEventModalOpen(true);
                                                                }}
                                                                className="size-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                                                title="Edit Event"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteEvent(event)}
                                                                className="size-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                                                title="Delete Event"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-3 min-w-0">
                                                        <h3 className="font-bold text-[16px] text-slate-800 leading-tight break-words">{event.title}</h3>
                                                        
                                                        {(event.hospital || event.lab || event.doctorName) && (
                                                            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-slate-600">
                                                                {event.doctorName && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span> {event.doctorName}</span>}
                                                                {event.hospital && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">local_hospital</span> {event.hospital}</span>}
                                                                {event.lab && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">science</span> {event.lab}</span>}
                                                            </div>
                                                        )}

                                                        {event.description && (
                                                            <p className="text-sm text-slate-600">{event.description}</p>
                                                        )}

                                                        {/* Attached Folders */}
                                                        {event.folderIds && event.folderIds.length > 0 && (
                                                            <div className="mt-3 pt-3 border-t border-white/40 space-y-2">
                                                                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Attached Folders</p>
                                                                <div className="space-y-3">
                                                                    {event.folderIds.map(folderId => {
                                                                        const folder = folders.find(f => f.id === folderId);
                                                                        if (!folder) return null;
                                                                        const folderDocs = docs.filter(d => d.folderId === folder.id);
                                                                        return (
                                                                            <div key={folderId} className="bg-slate-50/80 rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
                                                                                <div onClick={() => openFolderTimeline(folder.id)} className="flex gap-2 items-center p-2.5 hover:bg-slate-100 cursor-pointer transition-colors">
                                                                                    <div className="size-8 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                                                                                        <span className="material-symbols-outlined text-[16px]">folder</span>
                                                                                    </div>
                                                                                    <span className="text-[13px] font-bold text-slate-700 truncate">{folder.name}</span>
                                                                                    <span className="ml-auto text-[10px] font-extrabold bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-400">{folderDocs.length}</span>
                                                                                </div>
                                                                                {folderDocs.length > 0 && (
                                                                                    <div className="border-t border-slate-200/60 p-2 grid gap-3 bg-white/40">
                                                                                        {folderDocs.map(doc => renderDocumentCard(doc))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Attached Documents */}
                                                        {event.documentIds && event.documentIds.length > 0 && (
                                                            <div className="mt-3 pt-3 border-t border-white/40 space-y-2">
                                                                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Attached Documents</p>
                                                                <div className="grid gap-3">
                                                                    {event.documentIds.map(docId => {
                                                                        const doc = docs.find(d => d.id === docId);
                                                                        if (!doc) return null;
                                                                        return renderDocumentCard(doc);
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
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
                                    {filteredDocs.map(doc => renderDocumentCard(doc))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Folder View */}
                    {viewMode === "folder" && viewingFolderId && !loading && (
                        <div className="space-y-6">
                            {/* Back and Title */}
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setViewMode("dashboard"); setViewingFolderId(null); }} className="size-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                                    <span className="text-lg font-bold text-slate-600">←</span>
                                </button>
                                <h2 className="text-[17px] font-extrabold text-slate-900 ml-1">
                                    {folders.find(f => f.id === viewingFolderId)?.name || 'Folder'}
                                </h2>
                                <div className="ml-auto">
                                    <button
                                        onClick={() => navigate(`/dashboard?folderId=${viewingFolderId}`)}
                                        className="flex items-center gap-1.5 text-[13px] font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                        <Upload size={16} /> Upload Here
                                    </button>
                                </div>
                            </div>
                            
                            {/* Grid of docs */}
                            <div className="grid gap-3">
                                {docs.filter(d => d.folderId === viewingFolderId).map(doc => renderDocumentCard(doc))}
                                {docs.filter(d => d.folderId === viewingFolderId).length === 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-400">
                                        <FolderOpen size={32} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm font-semibold">Folder is empty.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* View Summary Modal */}
            {viewSummary && (
                <div className="fixed inset-0 z-[110] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe">
                    <div className="w-full max-w-2xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5 duration-300 max-h-[92dvh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-violet-50 rounded-t-[2.5rem] text-violet-900 flex-shrink-0 relative">
                            <div className="absolute top-0 right-0 size-32 bg-violet-100 rounded-full blur-3xl pointer-events-none -z-10"></div>
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
                                    rehypePlugins={[rehypeSanitize]}
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
                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex-shrink-0"
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
                    <div className="fixed inset-0 z-[110] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe">
                        <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-5 relative z-10">
                                <h3 className="font-extrabold text-[19px] text-slate-900 flex items-center gap-2"><Globe size={22} className="text-blue-500 mb-0.5" /> {t("documents.chooseLanguage")}</h3>
                                <button onClick={() => setShowLanguageModalForDoc(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            <p className="text-[13px] text-slate-500 font-semibold mb-5 leading-relaxed relative z-10">{t("documents.chooseLanguageDesc")}</p>
                            <select
                                value={summaryLanguage}
                                onChange={(e) => setSummaryLanguage(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-[1.5rem] border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/30 font-bold outline-none mb-6 cursor-pointer text-slate-800 transition-colors shadow-sm relative z-10"
                            >
                                {languages.map(lang => (
                                    <option key={lang.id} value={lang.id}>{t(lang.tKey)}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleGenerateNewSummary}
                                disabled={summarizingDocId !== null}
                                className="w-full py-3.5 bg-blue-500 text-white hover:bg-blue-600 font-extrabold rounded-[1.25rem] transition-colors flex items-center justify-center gap-2 shadow-md relative z-10 disabled:opacity-70 disabled:hover:bg-blue-500"
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
                (addToTimelineDoc || addToTimelineFolder) && (
                    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe" onClick={() => { setAddToTimelineDoc(null); setAddToTimelineFolder(null); }}>
                        <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2"><Activity size={20} className="text-blue-500" /> {t("documents.addToTimeline")}</h3>
                                <button onClick={() => { setAddToTimelineDoc(null); setAddToTimelineFolder(null); }} className="size-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><X size={18} /></button>
                            </div>
                            <p className="text-[13px] text-slate-500 font-semibold mb-5">{t("documents.linkDocToEvent", { name: addToTimelineDoc ? addToTimelineDoc.name : addToTimelineFolder?.name })}</p>

                            {addToTimelineDone ? (
                                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 font-bold text-sm">
                                    <span className="material-symbols-outlined text-blue-600">check_circle</span>
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
                                        onClick={() => addToTimelineDoc ? handleAddDocToEvent() : handleAddFolderToEvent()}
                                        disabled={addingToTimeline}
                                        className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-70 transition-colors"
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
                <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe" onClick={() => setEditingDoc(null)}>
                    <div className="w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl max-h-[88dvh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-[2.5rem] flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Edit2 size={18} className="text-blue-600" /> {t("documents.editTitle")}</h3>
                            </div>
                            <button onClick={() => setEditingDoc(null)} className="size-9 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-slate-600"><X size={18} /></button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editName")}</label>
                                    <input type="text" value={editDocDraft.name} onChange={e => setEditDocDraft({ ...editDocDraft, name: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Category</label>
                                    <select value={editDocDraft.category || ""} onChange={e => setEditDocDraft({ ...editDocDraft, category: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500">
                                        <option value="">No Category</option>
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.key} value={cat.key}>{t(cat.key)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editDate")}</label>
                                    <input type="date" value={editDocDraft.docDate} onChange={e => setEditDocDraft({ ...editDocDraft, docDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editPatient")}</label>
                                    <select value={editDocDraft.patientId} onChange={e => setEditDocDraft({ ...editDocDraft, patientId: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500">
                                        {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editDoctor")}</label>
                                    <input type="text" value={editDocDraft.doctorName} onChange={e => setEditDocDraft({ ...editDocDraft, doctorName: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editHospital")}</label>
                                    <input type="text" value={editDocDraft.hospital} onChange={e => setEditDocDraft({ ...editDocDraft, hospital: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("documents.editLab")}</label>
                                    <input type="text" value={editDocDraft.lab} onChange={e => setEditDocDraft({ ...editDocDraft, lab: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-blue-500" />
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
                                    className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"
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
                                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
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
                <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe" onClick={() => setViewingLinksDoc(null)}>
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
                            className="w-full mt-6 py-3.5 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
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

            {createFolderModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateFolderModalOpen(false)} />
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs relative z-10 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-extrabold text-[17px] text-slate-800">Create Folder</h3>
                            <button onClick={() => setCreateFolderModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><X size={16}/></button>
                        </div>
                        <form onSubmit={handleCreateFolder}>
                            <input 
                                autoFocus
                                type="text"
                                required
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="Folder Name (e.g. 2024 Scans)"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all">Create</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Rename Folder Modal */}
            {renamingFolder && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRenamingFolder(null)} />
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs relative z-10 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-extrabold text-[17px] text-slate-800">Rename Folder</h3>
                            <button onClick={() => setRenamingFolder(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><X size={16}/></button>
                        </div>
                        <input 
                            autoFocus
                            type="text"
                            value={renameFolderName}
                            onChange={e => setRenameFolderName(e.target.value)}
                            placeholder="New folder name"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setRenamingFolder(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                            <button onClick={handleRenameFolder} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all">Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Folder Confirmation Modal */}
            {deletingFolder && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setDeletingFolder(null); setDeleteFolderDocs(false); }} />
                    <div className="bg-white rounded-3xl p-6 w-full max-w-xs relative z-10 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-extrabold text-[17px] text-slate-800">Delete Folder</h3>
                            <button onClick={() => { setDeletingFolder(null); setDeleteFolderDocs(false); }} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><X size={16}/></button>
                        </div>
                        <p className="text-sm text-slate-600 font-semibold mb-4">Are you sure you want to delete '{deletingFolder.name}'?</p>
                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={deleteFolderDocs}
                                onChange={e => setDeleteFolderDocs(e.target.checked)}
                                className="size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm font-semibold text-slate-700">Also delete all documents inside this folder</span>
                        </label>
                        {deleteFolderDocs ? (
                            <p className="text-[12px] font-bold text-red-600 bg-red-50 p-2.5 rounded-lg mb-4">
                                ⚠️ This will permanently delete {docs.filter(d => d.folderId === deletingFolder.id).length} documents.
                            </p>
                        ) : (
                            <p className="text-[12px] font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-lg mb-4">
                                Documents will remain in your timeline and list view.
                            </p>
                        )}
                        <div className="flex gap-3">
                            <button onClick={() => { setDeletingFolder(null); setDeleteFolderDocs(false); }} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancel</button>
                            <button
                                onClick={handleDeleteFolder}
                                disabled={isDeletingFolder}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {isDeletingFolder ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        {/* Event Editor Modal */}
        {createEventModalOpen && createPortal(
            <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pt-safe pb-safe bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-extrabold text-[19px] text-slate-800">{editingEventId ? "Edit Event" : "New Event"}</h3>
                        <button onClick={() => setCreateEventModalOpen(false)} className="size-8 rounded-full bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm border border-slate-200">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-4">
                        <div>
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Event Title</label>
                            <input
                                type="text"
                                value={eventDraft.title}
                                onChange={e => setEventDraft({ ...eventDraft, title: e.target.value })}
                                placeholder="E.g., Yearly Checkup"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:font-medium placeholder:text-slate-400"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Date</label>
                            <input
                                type="date"
                                value={eventDraft.date}
                                onChange={e => setEventDraft({ ...eventDraft, date: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Description (Optional)</label>
                            <textarea
                                value={eventDraft.description}
                                onChange={e => setEventDraft({ ...eventDraft, description: e.target.value })}
                                placeholder="Add notes about this event..."
                                rows={3}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[15px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none placeholder:font-medium placeholder:text-slate-400"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Doctor Name</label>
                                <input
                                    type="text"
                                    value={eventDraft.doctorName}
                                    onChange={e => setEventDraft({ ...eventDraft, doctorName: e.target.value })}
                                    placeholder="Dr. Smith"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Hospital</label>
                                <input
                                    type="text"
                                    value={eventDraft.hospital}
                                    onChange={e => setEventDraft({ ...eventDraft, hospital: e.target.value })}
                                    placeholder="City Med"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider ml-1 mb-1.5 block">Lab (Optional)</label>
                            <input
                                type="text"
                                value={eventDraft.lab}
                                onChange={e => setEventDraft({ ...eventDraft, lab: e.target.value })}
                                placeholder="Quest Diagnostics"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                    </div>

                    <div className="p-5 border-t border-slate-100 flex gap-3">
                        <button
                            onClick={() => setCreateEventModalOpen(false)}
                            className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 active:scale-95 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveEvent}
                            disabled={isSavingEvent || !eventDraft.title.trim()}
                            className="flex-1 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_6px_16px_rgba(var(--primary-rgb),0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSavingEvent ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Save Event
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* Add Document to Event Modal */}
        {addDocToEventId && (
            <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe" onClick={() => setAddDocToEventId(null)}>
                <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-extrabold text-lg text-slate-900">Add Document</h3>
                        <button onClick={() => setAddDocToEventId(null)} className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><X size={18} /></button>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                        {(() => {
                            const ev = globalLifeEvents.find(e => e.id === addDocToEventId);
                            const availableDocs = docs.filter(d => !ev?.documentIds?.includes(d.id));
                            if (availableDocs.length === 0) return <p className="text-center py-8 text-slate-400 font-bold text-sm">No available documents to add.</p>;
                            
                            return availableDocs.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-200 transition-colors">
                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                        <div className="size-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                                            {doc.type.startsWith('image/') ? <img src={doc.url} alt="" className="w-full h-full object-cover rounded-lg" /> : <FileText size={14} className="text-primary/70" />}
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 truncate">{doc.name}</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!ev) return;
                                            try {
                                                const newIds = [...(ev.documentIds || []), doc.id];
                                                await updateDoc(fsDoc(db, 'life_events', ev.id), { documentIds: newIds });
                                                setGlobalLifeEvents(prev => prev.map(e => e.id === ev.id ? { ...e, documentIds: newIds } : e));
                                                setAddDocToEventId(null);
                                            } catch (e) {
                                                console.error(e);
                                                alert("Failed to link document.");
                                            }
                                        }}
                                        className="ml-2 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>
        )}

        {/* Move to Folder Modal */}
        {moveDocId && (
            <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe" onClick={() => setMoveDocId(null)}>
                <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-extrabold text-lg text-slate-900">Move to Folder</h3>
                        <button onClick={() => setMoveDocId(null)} className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><X size={18} /></button>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                        {folders.filter(f => f.patientId === selectedPatientId).length === 0 ? (
                            <p className="text-center py-8 text-slate-400 font-bold text-sm">No folders available.</p>
                        ) : (
                            folders.filter(f => f.patientId === selectedPatientId).map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={async () => {
                                        try {
                                            await updateDoc(fsDoc(db, 'documents', moveDocId), { folderId: folder.id });
                                            setDocs(docs.map(d => d.id === moveDocId ? { ...d, folderId: folder.id } : d));
                                            setMoveDocId(null);
                                        } catch (e) {
                                            console.error(e);
                                            alert("Failed to move document.");
                                        }
                                    }}
                                    className="w-full flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                                >
                                    <div className="size-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-blue-500">
                                        <FolderOpen size={16} />
                                    </div>
                                    <span className="font-bold text-sm text-slate-800">{folder.name}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Global Document Action Menu (Fixed Overlay) */}
        {activeDocMenu && (() => {
            const doc = docs.find(d => d.id === activeDocMenu);
            if (!doc) return null;
            return (
                <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-safe pb-safe" onClick={() => setActiveDocMenu(null)}>
                    <div className="w-full max-w-sm bg-white rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-5 duration-200 relative overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0">
                                    {doc.type.startsWith('image/') ? <img src={doc.url} alt="" className="w-full h-full object-cover rounded-xl" /> : <FileText size={18} className="text-primary/70" />}
                                </div>
                                <h3 className="font-extrabold text-sm text-slate-900 truncate" title={doc.name}>{doc.name}</h3>
                            </div>
                            <button onClick={() => setActiveDocMenu(null)} className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 flex-shrink-0"><X size={16} /></button>
                        </div>
                        <div className="p-2 pb-safe space-y-1 overflow-y-auto max-h-[60vh]">
                            <button onClick={() => { setActiveDocMenu(null); openEditDocModal(doc); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <Edit2 size={18} className="text-slate-400" /> Edit Document
                            </button>
                            <button onClick={() => { setActiveDocMenu(null); handleDocDownload(doc); }} disabled={downloadingDocId === doc.id} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors disabled:opacity-50">
                                {downloadingDocId === doc.id ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Download size={18} className="text-slate-400" />} Download
                            </button>
                            <button onClick={() => { setActiveDocMenu(null); openAddToTimeline(doc); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <Activity size={18} className="text-slate-400" /> Add to Timeline
                            </button>
                            <button onClick={() => { setActiveDocMenu(null); setShareDoc(doc); setSharedLink(""); setSharePin(""); setShareExpiry("24h"); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <LinkIcon size={18} className="text-slate-400" /> Share Securely
                            </button>
                            <button onClick={() => { setActiveDocMenu(null); handleDuplicateDoc(doc); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <Save size={18} className="text-slate-400" /> Duplicate
                            </button>
                            <button onClick={() => { setActiveDocMenu(null); setMoveDocId(doc.id); }} className="w-full px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <FolderOpen size={18} className="text-slate-400" /> Move to Folder
                            </button>
                            {doc.folderId && (
                                <button onClick={async () => { 
                                    setActiveDocMenu(null); 
                                    try {
                                        await updateDoc(fsDoc(db, 'documents', doc.id), { folderId: null });
                                        setDocs(docs.map(d => d.id === doc.id ? { ...d, folderId: undefined } : d));
                                    } catch (err) { alert("Failed to remove from folder"); }
                                }} className="w-full px-4 py-3 text-left text-sm font-bold text-amber-600 hover:bg-amber-50 rounded-xl flex items-center gap-3 transition-colors">
                                    <FolderMinus size={18} className="text-amber-500" /> Remove from Folder
                                </button>
                            )}
                            <div className="h-px bg-slate-100 my-2 mx-4" />
                            <button onClick={() => { setActiveDocMenu(null); handleQuickDeleteDoc(doc); }} className="w-full px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors">
                                <Trash2 size={18} className="text-red-500" /> Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}

        {/* Share Modal */}
        {shareDoc && (
            <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="size-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                <LinkIcon size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-[17px] text-slate-900 leading-tight">Secure Share</h3>
                                <p className="text-[11px] font-bold text-slate-500 truncate max-w-[150px]">{shareDoc.name}</p>
                            </div>
                        </div>
                        <button onClick={() => setShareDoc(null)} className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 pr-1 -mr-1 shrink-0 min-h-0">
                        {sharedLink ? (
                            <div className="space-y-6">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                                    <div className="size-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <LinkIcon size={24} />
                                    </div>
                                    <h4 className="font-bold text-emerald-800 mb-1">Link Created Successfully!</h4>
                                    <p className="text-xs text-emerald-600 font-medium">This link will expire in {shareExpiry}.</p>
                                    {sharePin && (
                                        <p className="text-xs font-bold text-emerald-800 mt-2 bg-emerald-100/50 p-2 rounded-lg">
                                            PIN: {sharePin}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={sharedLink} 
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-600"
                                        />
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(sharedLink);
                                                alert("Link copied to clipboard!");
                                            }}
                                            className="size-11 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0"
                                        >
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => window.open(`whatsapp://send?text=${encodeURIComponent(sharedLink)}`, '_blank')}
                                            className="flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#25D366] font-bold text-sm py-3 rounded-xl hover:bg-[#25D366]/20 transition-colors"
                                        >
                                            WhatsApp
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (navigator.share) {
                                                    navigator.share({
                                                        title: shareDoc.name,
                                                        text: "Document Link",
                                                        url: sharedLink
                                                    });
                                                } else {
                                                    alert("Native sharing not supported on this device.");
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold text-sm py-3 rounded-xl hover:bg-slate-200 transition-colors"
                                        >
                                            Share via...
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <form id="share-form" onSubmit={handleShareDoc} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Link Expiration</label>
                                    <select 
                                        value={shareExpiry}
                                        onChange={(e) => setShareExpiry(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 appearance-none outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="15m">15 Minutes</option>
                                        <option value="1h">1 Hour</option>
                                        <option value="24h">24 Hours</option>
                                        <option value="7d">7 Days</option>
                                        <option value="30d">30 Days</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                                        <Lock size={12} /> PIN Protection (Optional)
                                    </label>
                                    <p className="text-[11px] text-slate-400 pl-1 leading-snug">
                                        Add a 4-digit numeric PIN. If added, the document is completely encrypted and only viewable with this exact PIN.
                                    </p>
                                    <input 
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={4}
                                        value={sharePin}
                                        onChange={(e) => setSharePin(e.target.value)}
                                        placeholder="e.g. 1234"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-center text-lg font-black tracking-[0.5em] text-slate-700 placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </form>
                        )}
                    </div>

                    {!sharedLink && (
                        <div className="pt-4 shrink-0 mt-2">
                            <button 
                                type="submit"
                                form="share-form"
                                disabled={isSharing || (sharePin.length > 0 && sharePin.length !== 4)}
                                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-[15px] hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSharing ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : "Generate Secure Link"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        </div>
    );
}
