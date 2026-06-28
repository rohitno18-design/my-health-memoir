import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Search, X, FileText, User, Calendar, Loader2, Filter, ArrowDownAZ, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Filters & Sort
    const [filterType, setFilterType] = useState<"all" | "docs" | "patients" | "events">("all");
    const [sortBy, setSortBy] = useState<"relevance" | "newest" | "alpha">("relevance");
    
    // Results
    const [docs, setDocs] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch all data once when modal opens to allow instant filtering
    useEffect(() => {
        if (!isOpen || !user) return;
        
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [docsSnap, patientsSnap, eventsSnap] = await Promise.all([
                    getDocs(query(collection(db, "documents"), where("userId", "==", user.uid))),
                    getDocs(query(collection(db, "patients"), where("userId", "==", user.uid))),
                    getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)))
                ]);
                
                setDocs(docsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setPatients(patientsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Search fetch error", error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchAll();
        setTimeout(() => inputRef.current?.focus(), 100);
        
        // Reset query when opening
        setSearchQuery("");
        setFilterType("all");
        setSortBy("relevance");
    }, [isOpen, user]);

    // Keyboard shortcut to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const lowerQuery = searchQuery.toLowerCase().trim();
    
    // Filter functions
    let filteredDocs = docs.filter(d => 
        (d.name || "").toLowerCase().includes(lowerQuery) || 
        (d.category || "").toLowerCase().includes(lowerQuery) ||
        (d.extractedText || "").toLowerCase().includes(lowerQuery)
    );
    
    let filteredPatients = patients.filter(p => 
        (p.name || "").toLowerCase().includes(lowerQuery)
    );
    
    let filteredEvents = events.filter(e => 
        (e.title || "").toLowerCase().includes(lowerQuery) ||
        (e.description || "").toLowerCase().includes(lowerQuery)
    );

    // Apply Sort
    if (sortBy === "alpha") {
        filteredDocs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        filteredPatients.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        filteredEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "newest") {
        // Assume createdAt timestamp exists, or fallback
        filteredDocs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        filteredEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Patients usually don't have a 'date' but might have createdAt
        filteredPatients.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    }

    // Slice based on view type
    if (filterType !== "all") {
        if (filterType === "docs") {
            filteredPatients = [];
            filteredEvents = [];
            // Show more if filtered specifically
            filteredDocs = filteredDocs.slice(0, 15);
        } else if (filterType === "patients") {
            filteredDocs = [];
            filteredEvents = [];
            filteredPatients = filteredPatients.slice(0, 10);
        } else if (filterType === "events") {
            filteredDocs = [];
            filteredPatients = [];
            filteredEvents = filteredEvents.slice(0, 15);
        }
    } else {
        // All view limits
        filteredDocs = filteredDocs.slice(0, 5);
        filteredPatients = filteredPatients.slice(0, 3);
        filteredEvents = filteredEvents.slice(0, 3);
    }

    const hasResults = filteredDocs.length > 0 || filteredPatients.length > 0 || filteredEvents.length > 0;

    const handlePatientClick = (patientId: string) => {
        onClose();
        navigate(`/documents?patientId=${patientId}`);
    };

    const handleDocClick = (patientId: string, docId: string) => {
        onClose();
        navigate(`/documents?patientId=${patientId}&search=${encodeURIComponent(docs.find(d => d.id === docId)?.name || "")}`);
    };

    const handleEventClick = (patientId: string) => {
        onClose();
        navigate(`/documents?patientId=${patientId}&view=events`);
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-white md:bg-slate-900/40 md:backdrop-blur-sm flex items-start justify-center md:pt-[10vh] md:px-4 animate-in fade-in duration-200 pt-safe pb-safe">
            <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-2xl md:shadow-2xl overflow-hidden flex flex-col md:max-h-[80vh] animate-in slide-in-from-bottom-4 duration-300">
                
                {/* Search Input Area */}
                <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center gap-2 sm:gap-3 relative shrink-0">
                    <Search className="text-slate-400 shrink-0" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t("search.placeholder", "Search...")}
                        className="flex-1 min-w-0 bg-transparent text-base sm:text-lg font-semibold text-slate-800 outline-none placeholder:text-slate-300 placeholder:truncate"
                    />
                    <button 
                        onClick={onClose}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filters Area */}
                {!loading && (
                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center shrink-0">
                        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto custom-scrollbar pb-1 sm:-mb-1 w-full sm:w-auto sm:mr-auto">
                            {([
                                { id: "all", label: t("search.filterAll", "All") },
                                { id: "docs", label: t("search.filterDocs", "Documents") },
                                { id: "events", label: t("search.filterEvents", "Events") },
                                { id: "patients", label: t("search.filterFamily", "Family") }
                            ] as const).map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilterType(f.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                                        filterType === f.id 
                                            ? 'bg-blue-100 text-blue-700' 
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shrink-0 self-start sm:self-auto">
                            <button
                                onClick={() => setSortBy("relevance")}
                                className={`p-1.5 rounded-md ${sortBy === 'relevance' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                title={t("search.sortRelevance", "Sort by Relevance")}
                            >
                                <Filter size={16} />
                            </button>
                            <button
                                onClick={() => setSortBy("newest")}
                                className={`p-1.5 rounded-md ${sortBy === 'newest' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                title={t("search.sortNewest", "Newest First")}
                            >
                                <Clock size={16} />
                            </button>
                            <button
                                onClick={() => setSortBy("alpha")}
                                className={`p-1.5 rounded-md ${sortBy === 'alpha' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                title={t("search.sortAlpha", "A-Z")}
                            >
                                <ArrowDownAZ size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="p-8 flex justify-center text-slate-400 flex-1">
                        <Loader2 className="animate-spin" size={24} />
                    </div>
                )}

                {/* Results Area */}
                {!loading && searchQuery.length > 1 && (
                    <div className="overflow-y-auto p-2 custom-scrollbar flex-1 relative">
                        {!hasResults ? (
                            <div className="p-8 text-center text-slate-400 font-medium">
                                {t("search.noResults", "No results found for")} "{searchQuery}"
                            </div>
                        ) : (
                            <div className="space-y-4 p-2 pb-20 md:pb-4">
                                {/* Patients Results */}
                                {filteredPatients.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">{t("search.familyMembers", "Family Members")}</h3>
                                        <div className="space-y-1">
                                            {filteredPatients.map(p => (
                                                <button 
                                                    key={p.id}
                                                    onClick={() => handlePatientClick(p.id)}
                                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 group transition-colors text-left"
                                                >
                                                    <div className="size-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                                        <User size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 group-hover:text-blue-700">{p.name}</div>
                                                        <div className="text-xs text-slate-500 font-medium">{t("search.viewDocumentVault", "View Document Vault")}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Events Results */}
                                {filteredEvents.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-4">{t("search.healthEvents", "Health Events")}</h3>
                                        <div className="space-y-1">
                                            {filteredEvents.map(e => {
                                                const pName = patients.find(p => p.id === e.patientId)?.name || 'Unknown';
                                                return (
                                                    <button 
                                                        key={e.id}
                                                        onClick={() => handleEventClick(e.patientId)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-50 group transition-colors text-left"
                                                    >
                                                        <div className="size-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                                            <Calendar size={18} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-slate-800 group-hover:text-emerald-700 truncate">{e.title}</div>
                                                            <div className="text-xs text-slate-500 font-medium truncate">{new Date(e.date).toLocaleDateString()} • {pName}</div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Documents Results */}
                                {filteredDocs.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 mt-4">{t("search.documents", "Documents")}</h3>
                                        <div className="space-y-1">
                                            {filteredDocs.map(d => {
                                                const pName = patients.find(p => p.id === d.patientId)?.name || 'Unknown';
                                                const safeCat = d.category ? d.category.replace('documents.cat_', '').replace(/^cat_/, '').toLowerCase().replace(/[^a-z]/g, '') : '';
                                                const catLabel = safeCat ? (t(`documents.cat_${safeCat}`) || d.category) : 'Uncategorized';
                                                return (
                                                    <button 
                                                        key={d.id}
                                                        onClick={() => handleDocClick(d.patientId, d.id)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 group transition-colors text-left"
                                                    >
                                                        <div className="size-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-slate-800 group-hover:text-violet-700 truncate">{d.name}</div>
                                                            <div className="text-xs text-slate-500 font-medium truncate">{pName} • {catLabel}</div>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {!loading && searchQuery.length <= 1 && (
                    <div className="p-8 text-center text-slate-400 font-medium flex-1">
                        <Search className="mx-auto mb-3 opacity-20" size={40} />
                        {t("search.typeToSearch", "Type at least 2 characters to search.")}
                    </div>
                )}

            </div>
        </div>,
        document.body
    );
}
