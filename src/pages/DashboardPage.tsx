import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Bot, UploadCloud, Loader2, X,
  ChevronRight, Zap, WifiOff
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { db, storage } from "@/lib/firebase";
import { 
  collection, addDoc, serverTimestamp, query, where, 
  doc, updateDoc, onSnapshot 
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useTranslation } from "react-i18next";

// Bento Components
import { FamilyPulse } from "@/components/dashboard/FamilyPulse";
import { VitalsQuickView } from "@/components/dashboard/VitalsQuickView";
import { QuickActions } from "@/components/dashboard/QuickActions";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const MODEL_ID = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.0-flash";
const API_VERSION = import.meta.env.VITE_GEMINI_API_VERSION ?? "v1beta";
const API_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_ID}:streamGenerateContent?key=${API_KEY}&alt=sse`;

const SUMMARY_PROMPT = (lang: string) => `You are a medical AI assistant for I M Smrti. Analyze the document and provide a summary in ${lang}. Use Markdown formatting.`;

const CATEGORIES = [
    "cat_prescription", "cat_labreport", "cat_imagingxraymri", "cat_clinicalnote", "cat_billinginsurance", "cat_other"
];

const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });

export function DashboardPage() {
    const { userProfile, user } = useAuth();
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

    const [form, setForm] = useState({
        patientId: "",
        category: "cat_labreport",
        docDate: new Date().toISOString().split('T')[0],
        language: t("common.localeCode") === "hi-IN" ? t("common.language_hi") : t("common.language_en"),
        generateSummary: true
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

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
        const qPatients = query(collection(db, "patients"), where("userId", "==", user.uid));
        const unsubPatients = onSnapshot(qPatients, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPatients(data);
            if (data.length > 0 && !form.patientId) {
              setForm(f => ({ ...f, patientId: data[0].id }));
            }
            setLoading(false);
        });

        const currentPatientId = form.patientId || (patients.length > 0 ? patients[0].id : null);
        if (!currentPatientId) return;

        const qVitals = query(collection(db, "vitals"), where("userId", "==", user.uid), where("patientId", "==", currentPatientId));
        const unsubVitals = onSnapshot(qVitals, (snap) => {
            setVitals(snap.docs.map(d => d.data()));
        });

        return () => {
            unsubPatients();
            unsubVitals();
        };
    }, [user, form.patientId]);

    const formatGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t("dashboard.morning");
        if (hour < 17) return t("dashboard.afternoon");
        return t("dashboard.evening");
    };

    const handleFileSelect = (file: File) => {
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

            if (form.generateSummary) {
                setUploadStep("analyzing");
                const base64Data = await getBase64(selectedFile);
                const res = await fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: SUMMARY_PROMPT(form.language) },
                                { inline_data: { mime_type: selectedFile.type, data: base64Data } }
                            ]
                        }]
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Analysis complete.";
                    setAiSummary(text);
                    await updateDoc(doc(db, "documents", firestoreDocId), {
                        aiSummary: text,
                        status: "completed"
                    });
                }
                setUploadStep("summary");
            } else {
                setUploadStep("idle");
                navigate("/documents");
            }

        } catch (err) {
            console.error(err);
            setUploadStep("idle");
        }
    };

    const resetUpload = () => {
        setUploadStep("idle");
        setSelectedFile(null);
        setAiSummary("");
    };

    const getVitalData = (type: string) => {
        const filtered = vitals.filter(v => v.type === type).sort((a,b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
        const val = filtered.length > 0 ? filtered[filtered.length - 1].value : "--";
        const chartData = filtered.slice(-7).map((v: any) => ({
            date: "", 
            value: typeof v.value === 'string' ? parseInt(v.value.split('/')[0]) || 0 : v.value
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
                    <QuickActions onUpload={() => fileInputRef.current?.click()} onCamera={() => cameraInputRef.current?.click()} />
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

                {/* 3. Vitals Bento Grid */}
                {/* Patient context label — so user knows whose data is shown */}
                {patients.length > 0 && (
                    <div className="flex items-center gap-2 -mb-2">
                        <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            {t("dashboard.viewingVitalsFor")} <span className="text-emerald-600">{patients.find(p => p.id === form.patientId)?.name || patients[0]?.name || "—"}</span>
                        </p>
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
            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0]!)} />
            <input type="file" accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files?.[0]!)} />

            <AnimatePresence>
              {uploadStep === "uploading" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-6">
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

              {uploadStep === "form" && (
                // Bottom-sheet modal — slides up from bottom, never clips on small screens
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
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
                <div className="fixed inset-0 z-50 bg-white flex flex-col p-6 overflow-y-auto">
                  <header className="flex items-center justify-between mb-8 flex-shrink-0">
                    <div className="flex items-center gap-2">
                       <Bot className="text-violet-600" />
                       <h2 className="text-xl font-black">{t("dashboard.auditResults")}</h2>
                    </div>
                    <button onClick={resetUpload} className="size-10 bg-slate-100 rounded-full flex items-center justify-center"><X size={20} /></button>
                  </header>
                  <div className="prose prose-slate max-w-none flex-1">
                    <ReactMarkdown>{aiSummary}</ReactMarkdown>
                  </div>
                  <button onClick={() => navigate("/documents")} className="mt-8 w-full py-4 bg-slate-900 text-white rounded-xl font-black flex-shrink-0">
                    {t("dashboard.viewInVault")}
                  </button>
                </div>
              )}
            </AnimatePresence>
        </div>
    );
}
