import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, UploadCloud, Loader2, X, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const MODEL_ID = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.0-flash";
const API_VERSION = import.meta.env.VITE_GEMINI_API_VERSION ?? "v1beta";
const API_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_ID}:streamGenerateContent?key=${API_KEY}&alt=sse`;


const SUMMARY_PROMPT = (lang: string) => `You are a medical & general AI assistant. Analyze the uploaded document or image and provide a summary in ${lang}.
Use simple, clear, and reassuring language so a non-medical person can easily understand.
USE MARKDOWN FORMATTING for your response structure. Use '### ' for section headers and '- ' for bullet points. Do not use asterisks (** or *) for bolding unless necessary. 

IMPORTANT INSTRUCTIONS:
- The user may upload ANY image (like a photo of an injury, a broken car, general objects, etc.) even if it is not a standard medical document. 
- If the image does not look like a medical document or report, add a friendly note at the very top saying exactly: "This does not look like a standard medical document, but I will summarize what I see here for you!"
- Always start your summary by clearly stating exactly what this document or image is about.
- Always include the date of the document (extract it from the document, or use the user-provided date).

- IF this document represents a significant health event (like a surgery, hospital visit, diagnosis, or major life milestone), extract those details into a precise JSON block at the very end of your response. Use categories: 'visit', 'diagnosis', 'procedure', 'milestone', 'note'. Use YYYY-MM-DD format for date. 

Please follow EXACTLY this formatting style:

### ✅ What is this document?
- [State exactly what the document/photo is]

### ✅ First: The GOOD news (for medical reports) OR What I see (for general images)
- [Bullet points of normal findings or general visual descriptions]

### ❌ Now the important problems (these need attention)
- 🔴 [Problem 1: Details, causes]

### ✅ Summary in simple words
- [Brief simple conclusion]

### ✅ What should be done next (clear action plan)
- [Steps like 'See a doctor', 'Rest', 'Contact insurance', 'Keep it clean']

### 👉 Overall conclusion
- [One sentence takeaway]

### 📅 Proposed Life Event
\`\`\`json
{
  "isEvent": true,
  "title": "[Short title like 'Knee Surgery' or 'Diagnosed with Diabetes']",
  "category": "[One of: 'visit', 'diagnosis', 'procedure', 'milestone', 'note']",
  "date": "YYYY-MM-DD",
  "description": "[Brief 1-sentence description]"
}
\`\`\`
*(Omit this block if the document does not represent a specific event).*`;



const CATEGORIES = [
    "Prescription", "Lab Report", "Imaging (X-ray/MRI)", "Clinical Note", "Billing/Insurance", "Other"
];

const EVENT_CATEGORIES = [
    { id: "visit", label: "Doctor Visit" },
    { id: "diagnosis", label: "New Diagnosis" },
    { id: "procedure", label: "Surgery / Procedure" },
    { id: "milestone", label: "Health Milestone" },
    { id: "note", label: "General Note" },
];

const languages = [
    "English", "Hindi", "Hinglish", "Marathi", "Gujarati", "Tamil", "Telugu", "Bengali"
];

const quickLinks = [
    { label: "Vault", icon: "folder_managed", path: "/documents", color: "text-blue-600 bg-blue-50" },
    { label: "AI Chat", icon: "forum", path: "/ai-chat", color: "text-violet-600 bg-violet-50" },
    { label: "Patients", icon: "groups", path: "/patients", color: "text-emerald-600 bg-emerald-50" },
    { label: "Profile", icon: "account_circle", path: "/profile", color: "text-orange-600 bg-orange-50" },
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

    // Upload & Analysis State
    const [patients, setPatients] = useState<{ id: string, name: string }[]>([]);
    const [episodes, setEpisodes] = useState<{ id: string, name: string }[]>([]);
    const [uploadStep, setUploadStep] = useState<"idle" | "form" | "uploading" | "analyzing" | "summary">("idle");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [aiSummary, setAiSummary] = useState("");
    // Episode Creation State
    const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);
    const [newEpisodeName, setNewEpisodeName] = useState("");

    // Upfront Timeline State
    const [lifeEvents, setLifeEvents] = useState<{ id: string, title: string, date: string }[]>([]);

    const [form, setForm] = useState({
        patientId: "",
        category: "Lab Report",
        customCategory: "",
        episodeId: "",
        docDate: new Date().toISOString().split('T')[0],
        doctorName: "",
        hospital: "",
        lab: "",
        language: "English",
        generateSummary: true,
        timelineAction: "none" as "none" | "link" | "create",
        selectedEventId: "",
        newEventTitle: "",
        newEventDate: new Date().toISOString().split('T')[0],
        newEventCategory: "visit"
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)))
                .then(snap => {
                    const pts = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
                    setPatients(pts);
                    if (pts.length > 0) {
                        setForm(f => ({ ...f, patientId: pts[0].id }));
                    }
                });
        }
    }, [user]);

    // Fetch episodes & life events when patient changes
    useEffect(() => {
        if (user && form.patientId) {
            getDocs(query(collection(db, "episodes"), where("patientId", "==", form.patientId)))
                .then(snap => {
                    setEpisodes(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
                    setForm(f => ({ ...f, episodeId: "" })); // reset selected episode
                });
            getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid), where("patientId", "==", form.patientId)))
                .then(snap => {
                    setLifeEvents(snap.docs.map(d => ({ id: d.id, title: d.data().title, date: d.data().date })));
                    setForm(f => ({ ...f, timelineAction: "none", selectedEventId: "", newEventTitle: "", newEventDate: f.docDate, newEventCategory: "visit" }));
                });
        } else {
            setEpisodes([]);
            setLifeEvents([]);
        }
    }, [user, form.patientId]);

    const formatGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Prevent launching if no patient exists - prompt them to add one first
        if (patients.length === 0) {
            alert("Please add a patient profile first before uploading documents.");
            navigate("/patients");
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setUploadStep("form");

        if (fileInputRef.current) fileInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
    };

    const processUploadAndAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !user || !form.patientId) return;

        setUploadStep("uploading");
        setProgress(0);
        let uploadedUrl = "";
        let firestoreDocId = "";
        let finalEpisodeId = form.episodeId;

        try {
            // 0. Create new episode if needed
            if (isCreatingEpisode && newEpisodeName.trim()) {
                const epDoc = await addDoc(collection(db, "episodes"), {
                    userId: user.uid,
                    patientId: form.patientId,
                    name: newEpisodeName.trim(),
                    createdAt: serverTimestamp()
                });
                finalEpisodeId = epDoc.id;
            }

            // 1. Upload to Firebase Storage
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

            // 2. Initial Document Save to Firestore
            const newDoc = await addDoc(collection(db, "documents"), {
                userId: user.uid,
                patientId: form.patientId,
                name: selectedFile.name,
                type: selectedFile.type,
                category: form.category === "Other" ? form.customCategory : form.category,
                episodeId: finalEpisodeId || null,
                docDate: form.docDate,
                eventDate: form.docDate, // Save as both for backwards compatibility during migration
                doctorName: form.doctorName,
                hospital: form.hospital,
                lab: form.lab,
                url: uploadedUrl,
                status: form.generateSummary ? "analyzing" : "completed",
                aiSummary: form.generateSummary ? "" : "AI Summary generation was bypassed for this document.",
                createdAt: serverTimestamp(),
            });
            firestoreDocId = newDoc.id;


            // 3. Handle Upfront Timeline Event Linking
            if (form.timelineAction === "create" && form.newEventTitle.trim()) {
                await addDoc(collection(db, "life_events"), {
                    userId: user.uid,
                    patientId: form.patientId,
                    title: form.newEventTitle.trim(),
                    date: form.newEventDate,
                    description: `Primary event for ${selectedFile.name}`,
                    category: form.newEventCategory,
                    documentIds: [firestoreDocId],
                    createdAt: serverTimestamp()
                });
            } else if (form.timelineAction === "link" && form.selectedEventId) {
                await updateDoc(doc(db, "life_events", form.selectedEventId), {
                    documentIds: arrayUnion(firestoreDocId)
                });
            }

        } catch (err) {
            console.error(err);
            alert("Failed to upload the document. Please try again.");
            setUploadStep("idle");
            return;
        }

        // 4. Summarize using Gemini 2.0 Flash
        setUploadStep("analyzing");
        setAiSummary("");

        // Bypass AI if toggle is off
        if (!form.generateSummary) {
            setUploadStep("summary");
            setAiSummary("AI Summary generation was bypassed for this document. You can generate one later from the Documents vault.");
            return;
        }

        let finalSummaryText = "";

        try {
            const base64Data = await getBase64(selectedFile);
            const actualDocType = form.category === "Other" ? form.customCategory : form.category;

            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: `${SUMMARY_PROMPT(form.language)}\n\nHere is the document. It is a ${actualDocType}. The patient is male/female (adapt logically if visible). Hospital/Clinic: ${form.hospital}, Lab: ${form.lab}. Date: ${form.docDate}.` },
                            { inline_data: { mime_type: selectedFile.type, data: base64Data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.2 },
                })
            });

            if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`API response error: ${res.status} ${errorBody}`);
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split("\n").filter(l => l.trim().startsWith("data:"));

                    for (const line of lines) {
                        try {
                            const jsonStr = line.replace(/^data:\s*/, "");
                            const data = JSON.parse(jsonStr);
                            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                            if (text) {
                                finalSummaryText += text;
                                setAiSummary(prev => prev + text);
                            }
                        } catch (e) {
                            console.warn("Chunk parse error:", e, line);
                        }
                    }
                }
            }

            if (!finalSummaryText) {
                throw new Error("AI returned an empty summary.");
            }

            // We no longer extract JSON proposed events here because logic is now UPFRONT.
            // Just display the result.
            setUploadStep("summary");

            // Update the firestore doc with the final summary
            await updateDoc(doc(db, "documents", firestoreDocId), {
                aiSummary: finalSummaryText,
                aiSummaries: { [form.language]: finalSummaryText },
                status: "completed"
            });

        } catch (err: any) {
            console.error("AI Analysis Error Detail:", err);
            const errorMessage = err.message || "Unknown error";
            finalSummaryText = `The document was successfully uploaded, but AI analysis failed.\n\nError Details: ${errorMessage}\n\nYou can view your document in the Documents tab and try analyzing it again later.`;
            setAiSummary(finalSummaryText);
            setUploadStep("summary");



            if (firestoreDocId) {
                await updateDoc(doc(db, "documents", firestoreDocId), {
                    status: "failed",
                    aiSummary: `Analysis failed: ${errorMessage}`
                });
            }
        }
    };

    const resetUpload = () => {
        setUploadStep("idle");
        setSelectedFile(null);
        setAiSummary("");
    };



    return (
        <div className="pb-6 w-full max-w-lg mx-auto overflow-x-hidden">
            <div className="absolute top-0 left-0 right-0 h-[50vh] soft-gradient-bg -z-10 pointer-events-none"></div>

            {/* Welcome Section */}
            <section className="px-6 pt-8 pb-4">
                <p className="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">{formatGreeting()}, {userProfile?.displayName ? userProfile.displayName.split(' ')[0] : 'Guest'}</p>
                <h2 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-2">
                    Your health is in <br />
                    <span className="text-primary italic font-serif opacity-90">perfect harmony</span>
                </h2>
            </section>

            {/* AI Assistant Card (Advanced Glassmorphism) */}
            <section className="px-5 py-4">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-emerald-500 p-6 text-white shadow-xl shadow-primary/20">
                    <div className="absolute -top-12 -right-12 size-48 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="flex flex-col gap-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-sm border border-white/10">
                                <span className="material-symbols-outlined text-white text-[20px]">auto_awesome</span>
                            </div>
                            <span className="text-xs font-bold tracking-widest uppercase text-white/90">AI Health Intelligence</span>
                        </div>
                        <div className="space-y-2 max-w-[90%]">
                            <p className="text-lg font-semibold leading-snug">"I'm ready to analyze your latest medical reports. What would you like me to look at?"</p>
                        </div>
                        <div className="flex gap-3 pt-3">
                            <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white text-primary rounded-xl py-3 px-4 text-sm font-black shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2">
                                Upload Document
                                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                            </button>
                            <button onClick={() => cameraInputRef.current?.click()} className="size-12 shrink-0 bg-white/20 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-black/5 transition-all text-white">
                                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Hidden Inputs for AI Upload */}
                <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileSelect} />
                <input type="file" accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            </section>

            {/* AI Upload Progress Indicators */}
            {(uploadStep === "uploading" || uploadStep === "analyzing") && (
                <section className="mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="glass-card rounded-[2rem] p-6 shadow-sm border border-primary/10 flex flex-col items-center justify-center gap-5">
                        {uploadStep === "uploading" ? (
                            <>
                                <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center mb-1">
                                    <UploadCloud size={32} className="animate-bounce text-primary" />
                                </div>
                                <div className="w-full space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                        <span>Saving securely to Vault...</span>
                                        <span className="text-primary">{progress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-300 relative overflow-hidden" style={{ width: `${progress}%` }}>
                                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="relative mb-2">
                                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                                        <span className="material-symbols-outlined text-[36px] text-primary">auto_awesome</span>
                                    </div>
                                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                    <span className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center shadow-lg">
                                        <Loader2 size={10} className="text-white animate-spin" />
                                    </span>
                                </div>
                                <div className="text-center space-y-1">
                                    <h3 className="font-extrabold text-lg text-slate-900">AI is analyzing...</h3>
                                    <p className="text-xs font-semibold text-slate-500">Extracting insights from your document</p>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            )}

            {/* Quick Search */}
            <section className="mb-4 mt-2">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const val = new FormData(e.currentTarget).get("search") as string;
                    if (val) navigate(`/documents?search=${encodeURIComponent(val)}`);
                }} className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">search</span>
                    <input
                        name="search"
                        type="text"
                        placeholder="Search disease, hospital..."
                        className="w-full pl-12 pr-4 py-4 rounded-[1.5rem] border border-white/40 bg-white/40 backdrop-blur-md focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-700 shadow-sm outline-none placeholder:text-slate-400"
                    />
                    <button type="submit" className="hidden">Search</button>
                </form>
            </section>

            {/* Quick Access Grid */}
            <section className="pb-8 space-y-3 mt-2">
                <h3 className="text-[17px] font-extrabold text-slate-900 mb-3 px-1">Quick Access</h3>
                <div className="grid grid-cols-2 gap-3">
                    {quickLinks.map(({ label, icon, path, color }) => (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className="bg-white/40 backdrop-blur-md border border-white/40 rounded-[1.5rem] p-4 flex flex-col items-start gap-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95 group"
                        >
                            <div className={cn("size-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform", color)}>
                                <span className="material-symbols-outlined text-[24px]">{icon}</span>
                            </div>
                            <span className="text-[14px] font-extrabold text-slate-800">{label}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Meta Form Modal */}
            {uploadStep === "form" && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-card rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-bold">Document Details</h3>
                                <p className="text-xs text-muted-foreground">Fill in details for precise AI analysis</p>
                            </div>
                            <button onClick={resetUpload} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><X size={16} /></button>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                            <form onSubmit={processUploadAndAnalyze} className="space-y-4 pb-2">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Attach to Patient *</label>
                                    <div className="flex gap-2 items-center">
                                        <select required value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border border-input bg-background/50 font-medium">
                                            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/patients')}
                                            className="px-4 py-3 bg-secondary text-secondary-foreground rounded-xl text-sm font-bold flex-shrink-0"
                                        >
                                            + Patient
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Document Category *</label>
                                        <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium">
                                            {CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between mb-1.5 ml-1">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Episode of Care</label>
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingEpisode(!isCreatingEpisode)}
                                                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider whitespace-nowrap"
                                            >
                                                {isCreatingEpisode ? "Cancel" : "+ New"}
                                            </button>
                                        </div>
                                        {isCreatingEpisode ? (
                                            <input type="text" value={newEpisodeName} onChange={e => setNewEpisodeName(e.target.value)} placeholder="e.g. Knee Surgery 2023" className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium" />
                                        ) : (
                                            <select value={form.episodeId} onChange={e => setForm({ ...form, episodeId: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium">
                                                <option value="">None (General)</option>
                                                {episodes.map(ep => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Document Date *</label>
                                        <input type="date" required value={form.docDate} onChange={e => setForm({ ...form, docDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium" />
                                    </div>
                                </div>
                                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Doctor Name</label>
                                            <input type="text" value={form.doctorName} onChange={e => setForm({ ...form, doctorName: e.target.value })} placeholder="Optional" className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Hospital / Clinic</label>
                                            <input type="text" value={form.hospital} onChange={e => setForm({ ...form, hospital: e.target.value })} placeholder="Optional" className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">Lab Name</label>
                                            <input type="text" value={form.lab} onChange={e => setForm({ ...form, lab: e.target.value })} placeholder="Optional" className="w-full px-4 py-3 rounded-xl border border-input bg-background/50 font-medium" />
                                        </div>
                                    </div>

                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-3">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1 flex items-center gap-1.5 text-blue-800"><Activity size={14} /> Timeline Linking</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <button type="button" onClick={() => setForm({ ...form, timelineAction: "none" })} className={`px-2 sm:px-3 py-2 rounded-xl text-xs font-bold transition-all border ${form.timelineAction === "none" ? "bg-slate-800 text-white shadow-sm border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                                            Skip Timeline
                                        </button>
                                        <button type="button" onClick={() => setForm({ ...form, timelineAction: "link" })} className={`px-2 sm:px-3 py-2 rounded-xl text-xs font-bold transition-all border ${form.timelineAction === "link" ? "bg-blue-600 text-white shadow-sm border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                                            Link to Existing
                                        </button>
                                        <button type="button" onClick={() => setForm({ ...form, timelineAction: "create" })} className={`px-2 sm:px-3 py-2 rounded-xl text-xs font-bold transition-all border ${form.timelineAction === "create" ? "bg-emerald-600 text-white shadow-sm border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                                            + New Event
                                        </button>
                                    </div>

                                    {form.timelineAction === "link" && (
                                        <div className="pt-2 animate-in slide-in-from-top-2 fade-in">
                                            <select required value={form.selectedEventId} onChange={e => setForm({ ...form, selectedEventId: e.target.value })} className="w-full px-4 py-3 bg-white border border-blue-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-300">
                                                <option value="">— Select an Event —</option>
                                                {lifeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {form.timelineAction === "create" && (
                                        <div className="pt-2 animate-in slide-in-from-top-2 fade-in space-y-2">
                                            <input required type="text" placeholder="Event Title (e.g. Broken Arm Recovery)" value={form.newEventTitle} onChange={e => setForm({ ...form, newEventTitle: e.target.value })} className="w-full px-4 py-3 bg-white border border-emerald-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-300 placeholder:font-medium placeholder:text-slate-400" />
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest ml-1">Event Date</label>
                                                    <input type="date" value={form.newEventDate} onChange={e => setForm({ ...form, newEventDate: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-emerald-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-300" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest ml-1">Category</label>
                                                    <select value={form.newEventCategory} onChange={e => setForm({ ...form, newEventCategory: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-emerald-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-emerald-300">
                                                        {EVENT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-emerald-900 flex items-center gap-1.5"><Bot size={16} /> Generate AI Summary</span>
                                        <span className="text-xs font-medium text-emerald-700">Extract insights and suggested events</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={form.generateSummary} onChange={e => setForm({ ...form, generateSummary: e.target.checked })} />
                                        <div className="w-11 h-6 bg-emerald-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>

                                {form.generateSummary && (
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1 flex items-center gap-1.5 text-violet-600"><Bot size={14} /> Summary Language</label>
                                        <select required={form.generateSummary} value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-violet-100 bg-violet-50/50 text-violet-900 font-bold focus:ring-violet-500">
                                            {languages.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                )}

                                <button type="submit" className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 mt-2 shadow-lg hover:shadow-xl transition-all mb-2">
                                    <UploadCloud size={18} /> {form.generateSummary ? "Upload & Analyze instantly" : "Upload Document Instantly"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Summary Modal */}
            {
                uploadStep === "summary" && (
                    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="w-full max-w-2xl bg-card rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-5 duration-300 max-h-[92vh]">
                            <div className="p-5 border-b border-border flex justify-between items-center bg-violet-50/50 rounded-t-3xl text-violet-900">
                                <div>
                                    <h2 className="font-bold flex items-center gap-2"><Bot size={20} className="text-violet-600" /> AI Summary Complete</h2>
                                    <p className="text-xs font-medium text-violet-700/70 mt-0.5">Translated securely using Gemini Health Model</p>
                                </div>
                                <button onClick={resetUpload} className="w-8 h-8 flex items-center justify-center rounded-full bg-violet-100 hover:bg-violet-200">
                                    <X size={18} />
                                </button>
                            </div>



                            <div className="overflow-y-auto px-6 py-4 scroll-smooth custom-scrollbar flex-1 bg-white">
                                <div className="prose prose-sm max-w-none text-foreground font-medium leading-relaxed">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ ...props }) => <h1 className="text-[18px] font-extrabold text-slate-900 mt-5 mb-2 leading-tight" {...props} />,
                                            h2: ({ ...props }) => <h2 className="text-[16px] font-bold text-slate-800 mt-5 mb-2 leading-tight" {...props} />,
                                            h3: ({ ...props }) => <h3 className="text-[15px] font-bold text-slate-800 mt-4 mb-2 leading-tight border-b pb-1 border-slate-100" {...props} />,
                                            strong: ({ ...props }) => <strong className="font-bold text-slate-800" {...props} />,
                                            ul: ({ ...props }) => <ul className="list-disc pl-5 my-2 space-y-1.5 text-slate-700" {...props} />,
                                            ol: ({ ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1.5 text-slate-700" {...props} />,
                                            li: ({ ...props }) => <li className="leading-relaxed text-sm" {...props} />,
                                            p: ({ ...props }) => <p className="mb-2.5 leading-relaxed text-sm text-slate-700" {...props} />,
                                        }}
                                    >
                                        {aiSummary}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            <div className="p-4 border-t border-border bg-gray-50/50 rounded-b-3xl">
                                <button onClick={resetUpload} className="w-full py-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold rounded-xl transition-colors">
                                    Close & Back to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
