import { useState, useEffect } from "react";
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc as fsDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { LifeEvent, Patient } from "@/pages/PatientsPage";
import { Loader2, Activity, FileText, User as UserIcon, ChevronDown, ChevronUp, ExternalLink, Bot, X, Edit2, Trash2, Save } from "lucide-react";
import { EVENT_CATEGORIES } from "@/components/LifeTimeline";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

interface Doc {
    id: string;
    name: string;
    type: string;
    url: string;
    patientId: string;
    aiSummary?: string;
}

export function GlobalTimelinePage() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [events, setEvents] = useState<(LifeEvent & { patientName?: string, patientPhoto?: string })[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [allDocs, setAllDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterPatient, setFilterPatient] = useState<string | null>(null);
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [viewingSummary, setViewingSummary] = useState<{ text: string, docName: string } | null>(null);

    // Edit Event State
    const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
    const [editDraft, setEditDraft] = useState({ title: "", category: "visit", date: "", description: "", documentIds: [] as string[], patientId: "" });
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeletingEvent, setIsDeletingEvent] = useState(false);

    const refetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const pSnap = await getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)));
            const pts = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
            setPatients(pts);

            const eSnap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
            let allEvents = eSnap.docs.map(d => {
                const data = d.data() as LifeEvent;
                const p = pts.find(pt => pt.id === data.patientId);
                return { ...data, id: d.id, patientName: p?.name || t("common.unknown"), patientPhoto: (p as any)?.photoURL };
            });
            allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setEvents(allEvents);

            const dSnap = await getDocs(query(collection(db, "documents"), where("userId", "==", user.uid)));
            setAllDocs(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Doc)));
        } catch (e) {
            console.error("Error fetching global timeline:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetchData();
    }, [user]);

    const openEditModal = (event: LifeEvent, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingEvent(event);
        setEditDraft({
            title: event.title,
            category: event.category,
            date: event.date,
            description: event.description || "",
            documentIds: event.documentIds || [],
            patientId: event.patientId
        });
    };

    const handleSaveEdit = async () => {
        if (!editingEvent) return;
        setIsSavingEdit(true);
        try {
            await updateDoc(fsDoc(db, "life_events", editingEvent.id), editDraft);
            setEditingEvent(null);
            refetchData();
        } catch (e) {
            console.error(e);
            alert(t("timeline.addError"));
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!editingEvent) return;
        if (!confirm(t("timeline.deleteConfirm"))) return;
        setIsDeletingEvent(true);
        try {
            await deleteDoc(fsDoc(db, "life_events", editingEvent.id));
            setEditingEvent(null);
            refetchData();
        } catch (e) {
            console.error(e);
            alert(t("timeline.deleteError"));
        } finally {
            setIsDeletingEvent(false);
        }
    };
    let filteredEvents = events;
    if (filterCategory) filteredEvents = filteredEvents.filter(e => e.category === filterCategory);
    if (filterPatient) filteredEvents = filteredEvents.filter(e => e.patientId === filterPatient);

    return (
        <div className="pb-32 w-full max-w-lg mx-auto overflow-x-hidden min-h-screen">
            <div className="absolute top-0 right-0 h-[60vh] w-full bg-emerald-500/10 blur-3xl pointer-events-none -z-10 rounded-full"></div>

            {/* Header */}
            <header className="flex items-center justify-between gap-4 pt-8">
                <div className="flex-1 text-center">
                    <h1 className="text-3xl font-black text-slate-900 leading-tight">{t("timeline.title1")} <br /> <span className="text-emerald-600">{t("timeline.title2")}</span></h1>
                </div>
            </header>

            {/* Subtitle */}
            <p className="text-center text-sm font-bold text-slate-400 mt-2">
                {t("timeline.subtitle")}
            </p>

            <section className="pt-8 pb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner border border-emerald-100">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-xl text-slate-900">{t("timeline.addEvent")}</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{t("timeline.addEventDesc")}</p>
                    </div>
                </div>
            </section>

            {/* Filters */}
            <div className="glass-card rounded-2xl p-4 shadow-sm border border-slate-200/60 mb-8 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t("timeline.patient")}</label>
                    <select value={filterPatient || ""} onChange={e => setFilterPatient(e.target.value || null)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                        <option value="">{t("timeline.allFamily")}</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t("timeline.eventType")}</label>
                    <select value={filterCategory || ""} onChange={e => setFilterCategory(e.target.value || null)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none">
                        <option value="">{t("timeline.allEvents")}</option>
                        {EVENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(`timeline.cat_${c.value}`)}</option>)}
                    </select>
                </div>
            </div>

            {/* Timeline */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-slate-300" /></div>
            ) : filteredEvents.length === 0 ? (
                <div className="text-center py-16 bg-white/50 rounded-[2rem] border border-white shadow-sm">
                    <Activity size={48} className="mx-auto mb-4 text-emerald-200" />
                    <p className="font-bold text-lg text-slate-800">{t("timeline.noEvents")}</p>
                    <p className="text-sm max-w-sm mx-auto mt-2 text-slate-500">{t("timeline.noEventsDesc")}</p>
                </div>
            ) : (
                <div className="relative pl-6 border-l-2 border-slate-200/60 pb-12 space-y-6">
                    {filteredEvents.map(event => {
                        const cat = EVENT_CATEGORIES.find(c => c.value === event.category) || EVENT_CATEGORIES[0];
                        const isExpanded = expandedEventId === event.id;
                        const colorBorder = cat.color.split(' ')[0].replace('text-', 'border-').replace('600', '300');
                        const colorBg = cat.color.split(' ')[1];
                        const colorText = cat.color.split(' ')[0];
                        const linkedDocs = allDocs.filter(d => event.documentIds?.includes(d.id));
                        const renderDate = new Date(event.date).toLocaleDateString(t("common.localeCode"), { month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                            <div key={event.id} className="relative group">
                                {/* Timeline dot */}
                                <div className={`absolute -left-[30px] top-5 size-5 rounded-full bg-white border-4 shadow-sm z-10 transition-transform group-hover:scale-125 ${colorBorder}`}></div>

                                <button
                                    className={`w-full rounded-3xl p-5 shadow-sm border-2 bg-white/80 backdrop-blur-md text-left transition-all hover:shadow-md ${isExpanded ? `${colorBorder} shadow-md` : 'border-slate-100 hover:border-slate-200'}`}
                                    onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                                >
                                    {/* Top row: date + patient badge */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg ${colorBg} ${colorText}`}>{renderDate}</span>
                                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                            <div className="size-5 rounded-full overflow-hidden bg-slate-200 shrink-0">
                                                {event.patientPhoto ? <img src={event.patientPhoto} className="w-full h-full object-cover" alt="" /> : <UserIcon size={10} className="m-auto mt-0.5 text-slate-400" />}
                                            </div>
                                            <span className="text-xs font-bold text-slate-600 pr-1">{event.patientName}</span>
                                        </div>
                                    </div>

                                    {/* Event title + category badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-extrabold text-xl text-slate-900 leading-tight">{event.title}</h3>
                                        <div className="flex items-center gap-2">
                                            {isExpanded && (
                                                <button onClick={(e) => openEditModal(event, e)} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                            <div className={`shrink-0 px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-[11px] font-bold border border-current/20 bg-white ${colorText}`}>
                                                {cat.icon} <span className="hidden sm:inline">{t(`timeline.cat_${cat.value}`)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview: description (collapsed) */}
                                    {!isExpanded && event.description && (
                                        <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">{event.description}</p>
                                    )}

                                    {/* Expand/collapse indicator */}
                                    <div className={`flex items-center justify-between mt-3 text-xs font-bold ${colorText}`}>
                                        <span>{linkedDocs.length > 0 ? `${linkedDocs.length} ${t(`timeline.documentAttached${linkedDocs.length > 1 ? '_other' : '_one'}`)}` : t("timeline.noDocuments")}</span>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 text-left">
                                            {event.description && (
                                                <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                                            )}

                                            {linkedDocs.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FileText size={12} /> {t("timeline.attachedDocs")}</p>
                                                    <div className="grid gap-2">
                                                        {linkedDocs.map(doc => (
                                                            <div key={doc.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                                                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="shrink-0 size-12 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                                                                    {doc.type?.startsWith('image/') ? <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" /> : <FileText size={20} className="text-slate-400" />}
                                                                </a>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-sm text-slate-800 truncate">{doc.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-blue-600 flex items-center gap-1 hover:underline"><ExternalLink size={11} /> {t("timeline.open")}</a>
                                                                        {doc.aiSummary && (
                                                                            <button onClick={e => { e.stopPropagation(); setViewingSummary({ text: doc.aiSummary!, docName: doc.name }); }} className="text-[11px] font-bold text-violet-600 flex items-center gap-1 hover:underline"><Bot size={11} /> {t("timeline.summary")}</button>
                                                                        )}
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                if (!confirm(t("timeline.confirmUnlink", { name: doc.name }))) return;
                                                                                const eventRef = fsDoc(db, "life_events", event.id);
                                                                                const newIds = (event.documentIds || []).filter(id => id !== doc.id);
                                                                                await updateDoc(eventRef, { documentIds: newIds });
                                                                                refetchData();
                                                                            }}
                                                                            className="text-[11px] font-bold text-red-600 flex items-center gap-1 hover:underline ml-auto"
                                                                        >
                                                                            <X size={11} /> {t("timeline.unlink")}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Summary Modal */}
            {viewingSummary && (
                <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setViewingSummary(null)}>
                    <div className="w-full max-w-2xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl max-h-[88vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b flex justify-between items-center bg-violet-50 rounded-t-[2.5rem]">
                            <div>
                                <h3 className="font-bold text-violet-900 flex items-center gap-2"><Bot size={18} className="text-violet-600" /> {t("timeline.aiSummary")}</h3>
                                <p className="text-xs text-violet-600/70 mt-0.5 font-semibold">{viewingSummary.docName}</p>
                            </div>
                            <button onClick={() => setViewingSummary(null)} className="size-9 rounded-full bg-violet-100 flex items-center justify-center hover:bg-violet-200"><X size={18} /></button>
                        </div>
                        <div className="overflow-y-auto p-6 flex-1">
                            <ReactMarkdown
                                components={{
                                    h3: ({ ...p }) => <h3 className="text-[15px] font-bold text-slate-800 mt-4 mb-2 border-b pb-1 border-slate-100" {...p} />,
                                    ul: ({ ...p }) => <ul className="list-disc pl-5 my-2 space-y-1 text-slate-700 text-sm" {...p} />,
                                    li: ({ ...p }) => <li className="leading-relaxed" {...p} />,
                                    p: ({ ...p }) => <p className="mb-2 text-sm text-slate-700 leading-relaxed" {...p} />,
                                }}
                            >
                                {viewingSummary.text}
                            </ReactMarkdown>
                        </div>
                        <div className="p-4 border-t">
                            <button onClick={() => setViewingSummary(null)} className="w-full py-3 bg-violet-600 text-white font-bold rounded-2xl text-sm hover:bg-violet-700 transition-colors">{t("timeline.close")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Event Modal */}
            {editingEvent && (
                <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditingEvent(null)}>
                    <div className="w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl max-h-[88vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-[2.5rem] flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-900 flex items-center gap-2"><Edit2 size={18} className="text-emerald-600" /> {t("timeline.editEvent")}</h3>
                            </div>
                            <button onClick={() => setEditingEvent(null)} className="size-9 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-slate-600"><X size={18} /></button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("timeline.editTitle")}</label>
                                    <input type="text" value={editDraft.title} onChange={e => setEditDraft({ ...editDraft, title: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("timeline.editDate")}</label>
                                    <input type="date" value={editDraft.date} onChange={e => setEditDraft({ ...editDraft, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("timeline.editCategory")}</label>
                                <select value={editDraft.category} onChange={e => setEditDraft({ ...editDraft, category: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500">
                                    {EVENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("timeline.patient")}</label>
                                    <select value={editDraft.patientId} onChange={e => setEditDraft({ ...editDraft, patientId: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-emerald-500">
                                        {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t("timeline.editDescription")}</label>
                                    <textarea value={editDraft.description} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} placeholder={t("timeline.editDescriptionPlace")} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/20 font-medium text-sm transition-all shadow-sm min-h-[100px] resize-none" />
                                </div>
                            </div>

                            {/* Linked Docs Management */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">{t("timeline.linkedDocs")}</label>
                                {editDraft.documentIds.length === 0 ? (
                                    <p className="text-xs text-slate-500">{t("timeline.noDocsLinked")}</p>
                                ) : (
                                    <div className="space-y-2">
                                        {editDraft.documentIds.map(docId => {
                                            const doc = allDocs.find(d => d.id === docId);
                                            return (
                                                <div key={docId} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                                                    <span className="text-sm font-semibold text-slate-700 truncate pr-4">{doc?.name || t("timeline.unknownDoc")}</span>
                                                    <button
                                                        onClick={() => setEditDraft({ ...editDraft, documentIds: editDraft.documentIds.filter(id => id !== docId) })}
                                                        className="size-7 rounded-md bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 flex-shrink-0"
                                                        title={t("timeline.unlinkDoc")}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t flex items-center justify-between bg-slate-50 rounded-b-[2.5rem]">
                            <button
                                onClick={handleDeleteEvent}
                                disabled={isDeletingEvent || isSavingEdit}
                                className="px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100 transition-colors flex items-center gap-2"
                            >
                                {isDeletingEvent ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                <span className="hidden sm:inline">{t("timeline.deleteEvent")}</span>
                            </button>

                            <button
                                onClick={handleSaveEdit}
                                disabled={isDeletingEvent || isSavingEdit}
                                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {t("timeline.saveChanges")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
