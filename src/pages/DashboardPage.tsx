import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Bot, UploadCloud, Loader2, X, ShieldCheck, 
  ChevronRight, Zap, UserCircle 
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
import { AIInsight } from "@/components/dashboard/AIInsight";
import { QuickActions } from "@/components/dashboard/QuickActions";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const MODEL_ID = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.0-flash";
const API_VERSION = import.meta.env.VITE_GEMINI_API_VERSION ?? "v1beta";
const API_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_ID}:streamGenerateContent?key=${API_KEY}&alt=sse`;

const SUMMARY_PROMPT = (lang: string) => `You are a medical AI assistant for the Universal Health OS. Analyze the document and provide a summary in ${lang}. Use Markdown formatting.`;

const CATEGORIES = [
    "Prescription", "Lab Report", "Imaging (X-ray/MRI)", "Clinical Note", "Billing/Insurance", "Other"
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
    const [uploadStep, setUploadStep] = useState<"idle" | "form" | "uploading" | "analyzing" | "summary">("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [aiSummary, setAiSummary] = useState("");

    const [form, setForm] = useState({
        patientId: "",
        category: "Lab Report",
        docDate: new Date().toISOString().split('T')[0],
        language: "English",
        generateSummary: true
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

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

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      );
    }

    return (
        <div className="pb-24 w-full max-w-lg mx-auto relative min-h-screen bg-slate-50/50">
            {/* Background */}
            <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-20%] w-full h-[60%] bg-emerald-500/5 blur-[120px] animate-pulse" />
                <div className="absolute bottom-0 right-0 w-full h-[40%] bg-primary/5 blur-[100px]" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-white/40">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                         <ShieldCheck className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 tracking-tight">Health OS</h1>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Universal Profile</p>
                    </div>
                </div>
                <button onClick={() => navigate("/profile")} className="size-10 rounded-full bg-white border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt="Profile" className="size-full object-cover" />
                    ) : (
                      <UserCircle className="text-slate-300" size={24} />
                    )}
                </button>
            </header>

            <main className="px-6 pt-6 space-y-8">
                {/* Greeting */}
                <section>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                        {formatGreeting()}, {userProfile?.displayName?.split(' ')[0] || "Guest"}
                    </motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-3xl font-black text-slate-900 leading-tight tracking-tighter">
                        Your Health <br /> <span className="text-emerald-600">at a Glance.</span>
                    </motion.h2>
                </section>

                {/* Bento Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bento-card col-span-2 md:col-span-1 min-h-[160px]">
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

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} 
                        className="bento-card col-span-2 min-h-[180px] bg-gradient-to-br from-violet-50/50 to-white cursor-pointer active:scale-[0.98] transition-all"
                        onClick={() => navigate("/ai-chat")}
                    >
                        <AIInsight type="Tip" content="Your dad's sugar trends are rising (4%). We suggest a quick HBA1C check this week." />
                    </motion.div>

                    <div className="col-span-2">
                        <QuickActions onUpload={() => fileInputRef.current?.click()} onCamera={() => cameraInputRef.current?.click()} />
                    </div>
                </div>

                {/* Emergency Card */}
                <section>
                    <button onClick={() => navigate("/emergency")} className="w-full p-6 rounded-[2rem] bg-rose-50 border border-rose-100 flex items-center justify-between group relative overflow-hidden">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="size-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
                                <Zap size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-black text-slate-800 text-lg">Emergency Pulse</h3>
                                <p className="text-xs font-bold text-rose-600/70 uppercase tracking-widest">Medical QR & SOS</p>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                </section>
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
                    <h3 className="font-black text-slate-900 text-lg">Uploading Securely...</h3>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{progress}% Complete</p>
                  </div>
                </motion.div>
              )}

              {uploadStep === "form" && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-white rounded-[2rem] p-6 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900">Document Scan</h3>
                      <button onClick={resetUpload} className="p-2 bg-slate-100 rounded-full"><X size={16} /></button>
                    </div>
                    <form onSubmit={processUploadAndAnalyze} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Patient</label>
                        <select required value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700">
                          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Category</label>
                        <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-700">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                        Begin AI Analysis
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
                      <h2 className="text-xl font-black">AI Audit Results</h2>
                    </div>
                    <button onClick={resetUpload} className="size-10 bg-slate-100 rounded-full flex items-center justify-center"><X size={20} /></button>
                  </header>
                  <div className="prose prose-slate max-w-none flex-1">
                    <ReactMarkdown>{aiSummary}</ReactMarkdown>
                  </div>
                  <button onClick={() => navigate("/documents")} className="mt-8 w-full py-4 bg-slate-900 text-white rounded-xl font-black flex-shrink-0">
                    Close and View in Vault
                  </button>
                </div>
              )}
            </AnimatePresence>
        </div>
    );
}
