import { useState, useRef, useEffect } from "react";
import { remoteLog } from "@/lib/remoteLog";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bot, UploadCloud, Loader2, X,
  ChevronRight, Zap, WifiOff, AlertTriangle,
  Activity, CheckCircle2
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { db, storage } from "@/lib/firebase";
import {
  collection, addDoc, serverTimestamp, query, where,
  doc, updateDoc, onSnapshot, getDocs
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useTranslation } from "react-i18next";
import { useFeatureFlags } from "@/lib/featureFlags";

// Bento Components
import { FamilyPulse } from "@/components/dashboard/FamilyPulse";
import { VitalsQuickView } from "@/components/dashboard/VitalsQuickView";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { getFunctions, httpsCallable } from "firebase/functions";
const pgFunctions = getFunctions();
const proxyGemini = httpsCallable<Record<string, unknown>, Record<string, unknown>>(pgFunctions, 'proxyGemini');

const SUMMARY_PROMPT = (lang: string) => `You are a medical AI assistant for I M Smrti. Analyze the document and provide a summary in ${lang}. Use Markdown formatting.`;

const CATEGORIES = [
    "cat_prescription", "cat_labreport", "cat_imagingxraymri", "cat_clinicalnote", "cat_billinginsurance", "cat_other"
];

const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        if (file.size > 20 * 1024 * 1024) {
          reject(new Error("File too large for AI analysis (max 20MB)"));
          return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
          } else {
            reject(new Error("Failed to read file as string"));
          }
        };
        reader.onerror = error => reject(error);
    });

// Gemini requires a valid MIME type — fall back to detecting from file extension
const getSafeMimeType = (file: File): string => {
    if (file.type && file.type !== "application/octet-stream") return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        bmp: "image/bmp",
        tiff: "image/tiff",
        tif: "image/tiff",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return mimeMap[ext] || "application/pdf"; // default to PDF as safest fallback
};

export function DashboardPage() {
    const { userProfile, user } = useAuth();
    const { flags } = useFeatureFlags();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Data State
    const [patients, setPatients] = useState<any[]>([]);
    const [vitals, setVitals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Upload & Analysis State
    const [uploadStep, setUploadStep] = useState<"idle" | "form" | "uploading" | "analyzing" | "summary" | "queued">("idle");
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [aiSummary, setAiSummary] = useState("");
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        patientId: "",
        category: "cat_labreport",
        docDate: new Date().toISOString().split('T')[0],
        language: t("common.localeCode") === "hi-IN" ? t("common.language_hi") : t("common.language_en"),
        generateSummary: true
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // "Add to Timeline" state
    const [lastUploadedDocId, setLastUploadedDocId] = useState("");
    const [showAddToTimeline, setShowAddToTimeline] = useState(false);
    const [lifeEvents, setLifeEvents] = useState<{ id: string; title: string; date: string; patientId: string }[]>([]);
    const [selectedTimelineEventId, setSelectedTimelineEventId] = useState("");
    const [addingToTimeline, setAddingToTimeline] = useState(false);
    const [uploadSuccessBanner, setUploadSuccessBanner] = useState(false);

    // Track network status for offline-aware uploads
    useEffect(() => {
        const goOnline = () => setIsOffline(false);
        const goOffline = () => setIsOffline(true);
        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    // Fetch Patients & Vitals
    useEffect(() => {
        if (!user) return;
        
        // Listen for patients first
        const qPatients = query(collection(db, "patients"), where("userId", "==", user.uid));
        const unsubPatients = onSnapshot(qPatients, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPatients(data);
            if (data.length > 0 && !form.patientId) {
              setForm(f => ({ ...f, patientId: data[0].id }));
            }
            setLoading(false);
        }, (err) => {
            console.error("Patients listener error:", err);
            setLoading(false);
        });

        return () => unsubPatients();
    }, [user]);

    // Separate effect for vitals based on selected patient
    useEffect(() => {
        if (!user || !form.patientId) return;

        const qVitals = query(
            collection(db, "vitals"), 
            where("userId", "==", user.uid), 
            where("patientId", "==", form.patientId)
        );
        
        const unsubVitals = onSnapshot(qVitals, (snap) => {
            setVitals(snap.docs.map(d => d.data()));
        }, (err) => {
            console.error("Vitals listener error:", err);
        });

        return () => unsubVitals();
    }, [user, form.patientId]);

    const formatGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t("dashboard.morning");
        if (hour < 17) return t("dashboard.afternoon");
        return t("dashboard.evening");
    };

    const handleFileSelect = (file: File | null | undefined) => {
        if (!file) return;
        setSelectedFile(file);
        setUploadStep("form");
    };

    const processUploadAndAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !user || !form.patientId) return;

        setUploadStep("uploading");
        setProgress(0);
        let uploadedUrl = "";
        let firestoreDocId = "";

        try {
            await remoteLog("Dashboard_UPLOAD_START", { fileName: selectedFile.name, type: selectedFile.type });
            const fileName = `${Date.now()}_${selectedFile.name}`;
            const storageRef = ref(storage, `documents/${user.uid}/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on("state_changed",
                    (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                    reject,
                    async () => {
                        uploadedUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve();
                    }
                );
            });

            const newDoc = await addDoc(collection(db, "documents"), {
                userId: user.uid,
                patientId: form.patientId,
                name: selectedFile.name,
                type: selectedFile.type,
                category: form.category,
                docDate: form.docDate,
                url: uploadedUrl,
                status: form.generateSummary ? "analyzing" : "completed",
                aiSummary: "",
                createdAt: serverTimestamp(),
            });
            firestoreDocId = newDoc.id;
            setLastUploadedDocId(newDoc.id);

            if (form.generateSummary) {
                setUploadStep("analyzing");
                const base64Data = await getBase64(selectedFile);
                
                const result = await proxyGemini({
                    contents: [{
                        parts: [
                            { text: SUMMARY_PROMPT(form.language) },
                            { inline_data: { mime_type: getSafeMimeType(selectedFile), data: base64Data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
                });
                const data = result.data as any;
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                    
                if (text) {
                    setAiSummary(text);
                    await updateDoc(doc(db, "documents", firestoreDocId), {
                        aiSummary: text,
                        status: "completed"
                    });
                } else {
                    throw new Error("AI analysis returned empty results.");
                }
                setUploadStep("summary");
            } else {
                setUploadStep("idle");
                navigate("/documents");
            }

        } catch (err: any) {
            console.error("Upload/Analyze error:", err);
            const msg = err?.message || "Upload failed. Please check your connection and try again.";
            // Update Firestore doc status so user can retry later
            if (firestoreDocId) {
                updateDoc(doc(db, "documents", firestoreDocId), {
                    status: "failed",
                    aiSummary: msg,
                }).catch(() => {});
            }
            await remoteLog("Dashboard_EXCEPTION", { message: err.message, stack: err.stack });
            // Show inline error instead of alert() — alerts are blocked on many mobile browsers
            setAiSummary("");
            setUploadStep("summary");
            setError(msg);
        }
    };

    const resetUpload = () => {
        setUploadStep("idle");
        setSelectedFile(null);
        setAiSummary("");
        setError("");
    };

    const onDismissSummary = () => {
        setUploadStep("idle");
        setAiSummary("");
        setError("");
        setUploadSuccessBanner(true);
    };

    const fetchLifeEventsForTimeline = async () => {
        if (!user) return;
        const snap = await getDocs(
            query(collection(db, "life_events"), where("userId", "==", user.uid))
        );
        setLifeEvents(
            snap.docs.map(d => ({
                id: d.id,
                title: d.data().title || "Untitled Event",
                date: d.data().date || "",
                patientId: d.data().patientId || "",
            }))
        );
    };

    const handleAddDocToEvent = async () => {
        if (!lastUploadedDocId || !user) return;
        setAddingToTimeline(true);
        try {
            if (selectedTimelineEventId) {
                const eventRef = doc(db, "life_events", selectedTimelineEventId);
                const eventSnap = await getDocs(
                    query(collection(db, "life_events"), where("userId", "==", user.uid))
                );
                const existingEvent = eventSnap.docs.find(d => d.id === selectedTimelineEventId);
                const existingIds: string[] = existingEvent?.data().documentIds || [];
                if (!existingIds.includes(lastUploadedDocId)) {
                    await updateDoc(eventRef, { documentIds: [...existingIds, lastUploadedDocId] });
                }
            } else {
                await addDoc(collection(db, "life_events"), {
                    userId: user.uid,
                    patientId: form.patientId,
                    title: selectedFile?.name?.replace(/\.[^/.]+$/, "") || "Document Upload",
                    category: "visit",
                    date: form.docDate || new Date().toISOString().split("T")[0],
                    description: "",
                    documentIds: [lastUploadedDocId],
                    createdAt: serverTimestamp(),
                });
            }
            setShowAddToTimeline(false);
            setSelectedTimelineEventId("");
        } catch (e) {
            console.error("Add to timeline error:", e);
        } finally {
            setAddingToTimeline(false);
        }
    };

    const getVitalData = (type: string) => {
        const filtered = vitals.filter(v => v.type === type).sort((a,b) => {
            const tA = a.timestamp?.toMillis?.() || (a.timestamp instanceof Date ? a.timestamp.getTime() : 0);
            const tB = b.timestamp?.toMillis?.() || (b.timestamp instanceof Date ? b.timestamp.getTime() : 0);
            return tA - tB;
        });
        const latest = filtered.length > 0 ? filtered[filtered.length - 1].value : "--";
        // Safe check: if latest is an object, stringify it to avoid React render crash
        const val = (typeof latest === 'object' && latest !== null) ? JSON.stringify(latest) : latest;
        
        const chartData = filtered.slice(-7).map((v: any) => ({
            date: "", 
            value: typeof v.value === 'string' ? parseInt(v.value.split('/')[0]) || 0 : (typeof v.value === 'number' ? v.value : 0)
        }));
        return { val, chartData: chartData.length > 0 ? chartData : [{date: "", value: 0}] };
    };

    const glucose = getVitalData("Sugar");
    const bp = getVitalData("Blood Pressure");
    const hr = getVitalData("Heart Rate");

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-dvh bg-slate-50">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      );
    }

    return (
        <div className="pb-24 w-full max-w-lg mx-auto relative">

            <main className="px-5 pt-5 space-y-6">
                {/* Upload success banner */}
                {uploadSuccessBanner && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span className="text-sm font-bold text-emerald-800">Document saved successfully!</span>
                    </div>
                    <button onClick={() => setUploadSuccessBanner(false)} className="shrink-0">
                      <X size={16} className="text-emerald-500" />
                    </button>
                  </motion.div>
                )}

                {/* Greeting */}
                <section>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                        {formatGreeting()}, {userProfile?.displayName?.split(' ')[0] || t("dashboard.guest")}
                    </motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-3xl font-black text-slate-900 leading-tight tracking-tighter">
                        {t("dashboard.healthAtAGlance1")} <br /> <span className="text-emerald-600">{t("dashboard.healthAtAGlance2")}</span>
                    </motion.h2>
                </section>

                {/* 1. Quick Actions (Core Value Loop) */}
                <section>
                    <QuickActions onUpload={() => fileInputRef.current?.click()} onCamera={() => cameraInputRef.current?.click()} documentAnalysisEnabled={flags.documentAnalysisEnabled} />
                </section>

                {/* 2. Emergency Card (Safety) */}
                <section>
                    <button onClick={() => navigate("/emergency")} className="w-full p-6 rounded-[2rem] bg-rose-50 border border-rose-100 flex items-center justify-between group relative overflow-hidden shadow-sm">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="size-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
                                <Zap size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-black text-slate-800 text-lg">{t("emergency.title")}</h3>
                                <p className="text-xs font-bold text-rose-600/70 uppercase tracking-widest">{t("emergency.subtitle")}</p>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                </section>

                {/* Patient vitals switcher — tap to switch whose vitals are shown */}
                {patients.length > 0 && (
                    <div className="space-y-2 -mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("dashboard.viewingVitalsFor")}</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                            {patients.map(p => {
                                const isActive = p.id === form.patientId || (!form.patientId && p.id === patients[0]?.id);
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => setForm(f => ({ ...f, patientId: p.id }))}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all active:scale-95 ${isActive ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                    >
                                        <div className={`size-5 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-black ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            {(p.name)?.[0]?.toUpperCase() ?? "?"}
                                        </div>
                                        {p.name?.split(" ")[0]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bento-card col-span-2 min-h-[160px]">
                        <FamilyPulse patients={patients} onSelect={(id) => navigate(`/documents?patientId=${id}`)} />
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} 
                        className="bento-card col-span-1 cursor-pointer active:scale-95 transition-all"
                        onClick={() => navigate("/vitals")}
                    >
                        <VitalsQuickView type="Sugar" value={glucose.val} unit="mg/dL" trend={glucose.val === "--" ? "stable" : "stable"} data={glucose.chartData} color="#10B981" />
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} 
                        className="bento-card col-span-1 cursor-pointer active:scale-95 transition-all"
                        onClick={() => navigate("/vitals")}
                    >
                        <VitalsQuickView type="BP" value={bp.val} unit="mmHg" trend={bp.val === "--" ? "stable" : "stable"} data={bp.chartData} color="#3B82F6" />
                    </motion.div>

                    {/* Heart Rate — spans full width so chart has room to breathe */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} 
                        className="bento-card col-span-2 cursor-pointer active:scale-95 transition-all"
                        onClick={() => navigate("/vitals")}
                    >
                        <VitalsQuickView type="Heart Rate" value={hr.val} unit="bpm" trend={hr.val === "--" ? "stable" : "stable"} data={hr.chartData} color="#F43F5E" />
                    </motion.div>
                </div>
            </main>

            {/* Modals & Inputs */}
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0])} />
            <input type="file" accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0])} />

            <AnimatePresence>
              {uploadStep === "uploading" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-md flex items-center justify-center p-6">
                  <div className="w-full max-w-xs text-center space-y-4">
                    <div className="size-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <UploadCloud className="text-emerald-600" size={32} />
                    </div>
                    <h3 className="font-black text-slate-900 text-lg">{t("dashboard.uploading")}</h3>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{progress}% {t("common.complete")}</p>
                  </div>
                </motion.div>
              )}

              {uploadStep === "analyzing" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-white/80 backdrop-blur-md flex items-center justify-center p-6">
                  <div className="w-full max-w-xs text-center space-y-4">
                    <div className="size-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <Bot className="text-violet-600" size={32} />
                    </div>
                    <h3 className="font-black text-slate-900 text-lg">{t("dashboard.analyzingDoc") || "Analyzing Document..."}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      AI is reading your document...
                    </p>
                    <Loader2 className="animate-spin text-violet-500 mx-auto mt-2" size={24} />
                  </div>
                </motion.div>
              )}

              {uploadStep === "form" && (
                // Bottom-sheet modal — slides up from bottom, never clips on small screens
                <div className="fixed inset-0 z-[110] flex flex-col justify-end">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={resetUpload}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="relative bg-white rounded-t-[2.5rem] px-6 pt-4 shadow-2xl"
                    style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
                  >
                    <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-black text-slate-900">{t("dashboard.docScan")}</h3>
                      <button onClick={resetUpload} className="p-2 bg-slate-100 rounded-full"><X size={16} /></button>
                    </div>

                    {/* Offline warning */}
                    {isOffline && (
                      <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-2xl">
                        <WifiOff size={16} className="text-orange-500 shrink-0" />
                        <p className="text-xs font-bold text-orange-700">You're offline. The file will be saved and analyzed when you reconnect.</p>
                      </div>
                    )}

                    <form onSubmit={processUploadAndAnalyze} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("patients.label")}</label>
                        <select required value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700">
                          <option value="" disabled>{t("dashboard.selectPatient")}</option>
                          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t("dashboard.category")}</label>
                        <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700">
                          {CATEGORIES.map(c => <option key={c} value={c}>{t(`documents.${c}`)}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                        {isOffline ? "Save & Queue for Analysis" : t("dashboard.beginAnalysis")}
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}

              {uploadStep === "summary" && (
                <div className="fixed inset-0 z-[110] flex flex-col justify-end">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onDismissSummary}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="relative bg-white rounded-t-[2.5rem] px-6 pt-4 shadow-2xl max-h-[85vh] overflow-y-auto"
                    style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
                  >
                    <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                    {error ? (
                      <div className="flex flex-col items-center text-center gap-4 py-6">
                        <div className="size-20 rounded-3xl bg-rose-100 text-rose-500 flex items-center justify-center">
                          <AlertTriangle size={36} />
                        </div>
                        <p className="text-slate-700 font-bold text-lg">Summary Generation Failed</p>
                        <p className="text-slate-500 text-sm max-w-xs leading-relaxed">{error}</p>
                        <button onClick={resetUpload} className="mt-2 px-8 py-3 bg-rose-500 text-white rounded-xl font-black">
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Bot className="text-violet-600" />
                            <h2 className="text-xl font-black">{t("dashboard.auditResults")}</h2>
                          </div>
                          <button onClick={onDismissSummary} className="size-10 bg-slate-100 rounded-full flex items-center justify-center"><X size={20} /></button>
                        </div>
                        <div className="prose prose-slate max-w-none">
                          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{aiSummary}</ReactMarkdown>
                        </div>
                        <div className="flex flex-col gap-3 mt-6 pb-2">
                          <button onClick={() => navigate("/documents")} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black">
                            {t("dashboard.viewInVault")}
                          </button>
                          <button onClick={() => { onDismissSummary(); fetchLifeEventsForTimeline(); setShowAddToTimeline(true); }} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black flex items-center justify-center gap-2">
                            <Activity size={20} />
                            Add to Timeline
                          </button>
                          <button onClick={onDismissSummary} className="w-full py-3 text-slate-500 font-bold text-sm">
                            Dismiss
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Add to Timeline Modal */}
            {showAddToTimeline && (
              <div className="fixed inset-0 z-[120] flex flex-col justify-end">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => { setShowAddToTimeline(false); setSelectedTimelineEventId(""); }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  className="relative bg-white rounded-t-[2.5rem] px-6 pt-4 shadow-2xl"
                  style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
                >
                  <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 mb-4">Add to Timeline</h3>
                  <p className="text-sm text-slate-500 mb-4">Link this document to an existing health event or create a new one.</p>

                  {lifeEvents.length > 0 && (
                    <select
                      value={selectedTimelineEventId}
                      onChange={e => setSelectedTimelineEventId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 mb-4"
                    >
                      <option value="">Create New Event</option>
                      {lifeEvents.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>
                      ))}
                    </select>
                  )}

                  {selectedTimelineEventId === "" && (
                    <p className="text-xs text-emerald-600 font-bold mb-4">A new timeline event will be created for this document.</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowAddToTimeline(false); setSelectedTimelineEventId(""); }}
                      className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddDocToEvent}
                      disabled={addingToTimeline}
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {addingToTimeline ? <Loader2 size={18} className="animate-spin" /> : <Activity size={18} />}
                      {addingToTimeline ? "Adding..." : selectedTimelineEventId ? "Link to Event" : "Create Event"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
        </div>
    );
}
