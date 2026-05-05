import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { LifeEvent, Patient } from "@/pages/PatientsPage";
import { Loader2, Plus, Calendar, Activity, X, FileText, ScanLine, Stethoscope, CheckCircle2 } from "lucide-react";

export const EVENT_CATEGORIES = [
    { value: "visit", label: "timeline.cat_visit", icon: <Stethoscope size={18} />, desc: "timeline.cat_desc_visit", color: "text-blue-600 bg-blue-50 border-blue-200" },
    { value: "diagnosis", label: "timeline.cat_diagnosis", icon: <Activity size={18} />, desc: "timeline.cat_desc_diagnosis", color: "text-red-600 bg-red-50 border-red-200" },
    { value: "procedure", label: "timeline.cat_procedure", icon: <ScanLine size={18} />, desc: "timeline.cat_desc_procedure", color: "text-teal-600 bg-teal-50 border-teal-200" },
    { value: "milestone", label: "timeline.cat_milestone", icon: <Calendar size={18} />, desc: "timeline.cat_desc_milestone", color: "text-amber-600 bg-amber-50 border-amber-200" },
    { value: "note", label: "timeline.cat_note", icon: <FileText size={18} />, desc: "timeline.cat_desc_note", color: "text-slate-600 bg-slate-50 border-slate-200" },
] as const;

export function LifeTimeline({ patient, onClose }: { patient: Patient, onClose: () => void }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [events, setEvents] = useState<LifeEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState<string | null>(null);

    // Modal state
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("visit");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState("");

    // Optional: Linking documents manually
    const [availableDocs, setAvailableDocs] = useState<{ id: string, name: string }[]>([]);
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

    useEffect(() => {
        const fetchEvents = async () => {
            if (!user) return;
            const q = query(collection(db, "life_events"), where("userId", "==", user.uid), where("patientId", "==", patient.id));
            const snap = await getDocs(q);
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as LifeEvent)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setLoading(false);
        };

        const fetchDocs = async () => {
            const qDocs = query(collection(db, "documents"), where("patientId", "==", patient.id));
            const snapDocs = await getDocs(qDocs);
            setAvailableDocs(snapDocs.docs.map(d => ({ id: d.id, name: d.data().name })));
        };

        fetchEvents();
        fetchDocs();
    }, [patient.id]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const newEvent = {
                userId: user?.uid,
                patientId: patient.id,
                title,
                category,
                date,
                description,
                documentIds: selectedDocs,
                createdAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, "life_events"), newEvent);
            setEvents(prev => [{ id: docRef.id, ...newEvent, createdAt: { seconds: Date.now() / 1000 } } as unknown as LifeEvent, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setShowAddEvent(false);
            // Reset form
            setTitle("");
            setCategory("visit");
            setDate(new Date().toISOString().split('T')[0]);
            setDescription("");
            setSelectedDocs([]);
        } catch (error) {
            console.error("Error adding life event: ", error);
            alert(t("documents.addTimelineError"));
        } finally {
            setSaving(false);
        }
    };

    const filteredEvents = filterCategory ? events.filter(e => e.category === filterCategory) : events;

    return (
        <div className="fixed inset-0 z-[110] bg-white sm:bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            {/* On mobile: full-height sheet but with safe-area top padding so header isn't clipped by notch/statusbar */}
            <div
                className="w-full max-w-4xl sm:h-auto sm:max-h-[85vh] glass-card sm:rounded-[2.5rem] flex flex-col shadow-2xl relative overflow-hidden bg-white/95"
                style={{ height: '100%', paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="absolute top-0 right-0 size-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-200/50 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <Activity className="text-emerald-500" />
                            {t("timeline.patient", { name: patient.name })}
                        </h2>
                        <p className="text-sm font-semibold text-slate-500 mt-1">{t("timeline.timelineDesc")}</p>
                    </div>
                    <button onClick={onClose} className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar relative">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilterCategory(null)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${!filterCategory ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {t("timeline.allEvents")}
                            </button>
                            {EVENT_CATEGORIES.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setFilterCategory(c.value)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterCategory === c.value ? c.color : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {t(c.label)}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowAddEvent(true)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-slate-800 active:scale-95 transition-all flex-shrink-0">
                            <Plus size={16} /> {t("timeline.addEvent")}
                        </button>
                    </div>

                    {/* Timeline Rendering */}
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-slate-400" /></div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <Activity size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="font-bold text-lg text-slate-800">{t("timeline.noEvents")}</p>
                            <p className="text-sm max-w-sm mx-auto mt-2 text-slate-500">{t("timeline.noEventsDesc")}</p>
                        </div>
                    ) : (
                        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200/60 pb-10 space-y-10">
                            {filteredEvents.map(event => {
                                const catMetadata = EVENT_CATEGORIES.find(c => c.value === event.category) || EVENT_CATEGORIES[0];
                                const renderDate = new Date(event.date).toLocaleDateString(t("common.localeCode"), { month: 'short', day: 'numeric', year: 'numeric' });

                                return (
                                    <div key={event.id} className="relative group">
                                        {/* Dot */}
                                        <div className={`absolute -left-[30px] sm:-left-[38px] top-4 size-5 rounded-full bg-white border-4 shadow-sm z-10 ${catMetadata.color.split(' ')[0].replace('text-', 'border-')}`}></div>

                                        <div className={`rounded-2xl p-5 shadow-sm border ${catMetadata.color.replace('text-', '').replace('bg-', 'bg-').split(' ')[1]} ${catMetadata.color.split(' ')[2]}`}>
                                            <span className={`text-[12px] font-extrabold uppercase tracking-wider block mb-1 ${catMetadata.color.split(' ')[0]}`}>{renderDate}</span>
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className="font-bold text-lg text-slate-900 leading-tight">{event.title}</h3>
                                                <div className={`px-3 py-1 bg-white/60 rounded-lg flex items-center gap-1.5 text-xs font-bold ${catMetadata.color.split(' ')[0]}`}>
                                                    {catMetadata.icon}
                                                    {t(catMetadata.label)}
                                                </div>
                                            </div>

                                            {event.description && (
                                                <p className="mt-3 text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                                            )}

                                            {event.documentIds && event.documentIds.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-900/10">
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1"><FileText size={14} /> {t("timeline.documentsAttached")}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {event.documentIds.map(docId => {
                                                            const docName = availableDocs.find(d => d.id === docId)?.name || t("common.unknown");
                                                            return <span key={docId} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/80 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm"><FileText size={12} className="text-slate-400" /> {docName}</span>
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Event Modal */}
            {showAddEvent && (
                <div className="absolute inset-0 z-[120] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full max-w-xl h-full sm:h-auto sm:max-h-[90vh] glass-card rounded-t-[2rem] sm:rounded-[2.5rem] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5 duration-300 relative overflow-hidden">
                        <div className="p-6 border-b border-white/30 flex justify-between items-center bg-slate-50 relative z-10 flex-shrink-0">
                            <div>
                                <h3 className="font-extrabold text-xl text-slate-900">{t("timeline.addEvent")}</h3>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">{t("timeline.addEventDesc")}</p>
                            </div>
                            <button onClick={() => setShowAddEvent(false)} className="text-slate-400 hover:text-slate-800 p-2 bg-slate-200/50 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-white custom-scrollbar relative z-10">
                            <form id="add-event-form" onSubmit={handleSave} className="space-y-5">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t("timeline.eventType")}</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {EVENT_CATEGORIES.map(c => (
                                            <div
                                                key={c.value}
                                                onClick={() => setCategory(c.value)}
                                                className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${category === c.value ? `border-${c.color.split(' ')[0].split('-')[1]}-500 bg-${c.color.split(' ')[0].split('-')[1]}-50/50 shadow-sm` : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                                            >
                                                <div className={category === c.value ? c.color.split(' ')[0] : 'text-slate-400'}>{c.icon}</div>
                                                <div>
                                                    <p className={`font-bold text-sm ${category === c.value ? 'text-slate-900' : 'text-slate-700'}`}>{t(c.label)}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{t(c.desc)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t("timeline.eventTitle")} *</label>
                                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder={t("timeline.eventTitlePlaceholder")} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/20 font-semibold text-sm transition-all shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t("timeline.eventDate")} *</label>
                                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/20 font-semibold text-sm transition-all shadow-sm cursor-pointer" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t("timeline.description")} ({t("common.optional")})</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t("timeline.descriptionPlaceholder")} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900/20 font-medium text-sm transition-all shadow-sm min-h-[100px] resize-none" />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t("timeline.linkedDocs")}</label>
                                    {availableDocs.length === 0 ? (
                                        <p className="text-xs text-slate-500 font-medium bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">{t("timeline.noDocsAvailable")}</p>
                                    ) : (
                                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 max-h-[150px] overflow-y-auto custom-scrollbar">
                                            {availableDocs.map(doc => (
                                                <label key={doc.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors user-select-none">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                        checked={selectedDocs.includes(doc.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedDocs([...selectedDocs, doc.id]);
                                                            else setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                                                        }}
                                                    />
                                                    <span className="text-sm font-semibold text-slate-700 truncate"><FileText size={14} className="inline mr-1 text-slate-400 mb-0.5" />{doc.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                            <button type="submit" form="add-event-form" disabled={saving} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-extrabold text-sm shadow-md hover:bg-slate-800 disabled:opacity-70 flex items-center justify-center gap-2 transition-all">
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} {t("timeline.saveChanges")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
