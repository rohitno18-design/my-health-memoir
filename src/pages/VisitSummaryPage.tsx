import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { callGeminiDirect, extractGeminiText, isMonthlyLimitError } from "@/lib/gemini";
import { usePlanLimits } from "@/lib/planLimits";
import { LimitModal } from "@/components/LimitModal";
import { logUserAction } from "@/lib/audit";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import jsPDF from "jspdf";
import {
    ArrowLeft, Stethoscope, FileDown, RefreshCw, Loader2,
    ShieldAlert, ChevronRight, Sparkles, User as UserIcon,
} from "lucide-react";

interface FamilyMember {
    id: string;
    name: string;
    relationship?: string;
    dob?: string;
    gender?: string;
    bloodGroup?: string;
    allergies?: string;
    conditions?: string;
    medications?: string;
    familyHistory?: string;
    surgicalHistory?: string;
    vaccinations?: string;
    photoURL?: string;
}

function calcAge(dob?: string): string {
    if (!dob) return "";
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return "";
    let age = new Date().getFullYear() - birth.getFullYear();
    const m = new Date().getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && new Date().getDate() < birth.getDate())) age--;
    return `${age}`;
}

export function VisitSummaryPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [selected, setSelected] = useState<FamilyMember | null>(null);
    const [visitReason, setVisitReason] = useState("");
    const [outputLang, setOutputLang] = useState<"en" | "ui">("en");
    const [generating, setGenerating] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [limitMessage, setLimitMessage] = useState<string | null>(null);
    const { limits } = usePlanLimits();

    const uiLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language.split("-")[0]);
    const showLangToggle = uiLang && uiLang.code !== "en";

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            try {
                const snap = await getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)));
                setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember)));
            } finally {
                setLoadingMembers(false);
            }
        };
        load();
    }, [user]);

    const generate = useCallback(async (member: FamilyMember) => {
        if (!user) return;
        setGenerating(true);
        setError(null);
        setSummary(null);
        try {
            // Gather everything we know about this family member
            const [docsSnap, vitalsSnap, eventsSnap, profileSnap] = await Promise.all([
                getDocs(query(collection(db, "documents"), where("userId", "==", user.uid), where("patientId", "==", member.id))),
                getDocs(query(collection(db, "vitals"), where("userId", "==", user.uid), where("patientId", "==", member.id))),
                getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid), where("patientId", "==", member.id))),
                getDoc(doc(db, "patients", member.id)),
            ]);

            const profile = profileSnap.exists() ? profileSnap.data() : member;

            const docs = docsSnap.docs
                .map(d => d.data())
                .sort((a, b) => (b.docDate || "").localeCompare(a.docDate || ""))
                .slice(0, 20)
                .map(d => ({
                    name: d.name, date: d.docDate || "", category: d.category || d.docType || "",
                    doctor: d.doctorName || "", hospital: d.hospital || d.lab || "",
                    findings: (d.aiSummary || "").slice(0, 500),
                }));

            const vitals = vitalsSnap.docs
                .map(d => d.data())
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                .slice(0, 40)
                .map(v => ({
                    type: v.type, value: v.value, unit: v.unit,
                    date: v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000).toISOString().split("T")[0] : "",
                }));

            const events = eventsSnap.docs
                .map(d => d.data())
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .slice(0, 10)
                .map(e => ({ title: e.title, date: e.date || "", description: (e.description || "").slice(0, 200) }));

            const langName = outputLang === "ui" && uiLang ? uiLang.name : "English";

            const prompt = `You are preparing a pre-appointment briefing document for a doctor visit in India.

PATIENT PROFILE:
- Name: ${profile.name}
- Age: ${calcAge(profile.dob) || "unknown"} | Gender: ${profile.gender || "unknown"} | Blood group: ${profile.bloodGroup || "unknown"}
- Known allergies: ${profile.allergies || "none recorded"}
- Known conditions: ${profile.conditions || "none recorded"}
- Current medications: ${profile.medications || "none recorded"}
- Family history: ${profile.familyHistory || "none recorded"}
- Surgical history: ${profile.surgicalHistory || "none recorded"}

RECENT MEDICAL DOCUMENTS (newest first): ${JSON.stringify(docs)}
RECENT VITALS READINGS (newest first): ${JSON.stringify(vitals)}
HEALTH TIMELINE EVENTS: ${JSON.stringify(events)}
${visitReason.trim() ? `REASON FOR THIS VISIT (stated by the caregiver): ${visitReason.trim()}` : ""}

Write a clear, one-page doctor visit briefing in ${langName} with EXACTLY these markdown sections:
## Patient Snapshot
## Current Medications & Allergies
## Active Conditions & History
## Recent Reports & Findings
## Vitals Trends
## Suggested Questions for the Doctor

Rules:
- Be factual. Use ONLY the data provided above. If a section has no data, write one line saying so.
- Highlight anything a doctor should notice (abnormal trends, medication changes, overdue follow-ups).
- Keep it under 450 words. No preamble, no closing remarks, start directly with the first section.
- Do not invent diagnoses. This is an organizational summary, not medical advice.`;

            const response = await callGeminiDirect({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
                feature: "visit_briefing",
            });
            const text = extractGeminiText(response);
            if (!text) throw new Error("Empty response");
            setSummary(text);
            logUserAction(user.uid, "VISIT_SUMMARY_GENERATED", `Generated visit summary for ${member.name}`, { patientId: member.id }).catch(() => undefined);
        } catch (e: any) {
            console.error("Visit summary generation failed:", e);
            if (isMonthlyLimitError(e)) {
                setLimitMessage(t("limits.briefingsBody", {
                    count: limits.freeVisitBriefingsPerMonth,
                    defaultValue: "You've used your {{count}} free doctor visit briefings this month. Upgrade to Premium for unlimited briefings.",
                }));
            } else {
                setError(t("visitSummary.error", "Could not generate the summary. Please try again."));
            }
        } finally {
            setGenerating(false);
        }
    }, [user, visitReason, outputLang, uiLang, t, limits]);

    const downloadPDF = useCallback(() => {
        if (!summary || !selected) return;
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.setFontSize(20);
        pdf.setTextColor(41, 98, 255);
        pdf.text("Doctor Visit Briefing", 14, 20);
        pdf.setFontSize(12);
        pdf.setTextColor(60);
        pdf.text(`${selected.name} — generated ${new Date().toLocaleDateString("en-IN")} via I M Smrti`, 14, 28);
        pdf.setDrawColor(200);
        pdf.line(14, 32, pageWidth - 14, 32);

        // Strip markdown to plain text with section spacing
        const plain = summary
            .replace(/^##\s*(.+)$/gm, "\n$1\n")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/^\s*[-*]\s+/gm, "• ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        pdf.setFontSize(10);
        pdf.setTextColor(0);
        const lines = pdf.splitTextToSize(plain, pageWidth - 28);
        let y = 40;
        for (const line of lines) {
            if (y > pageHeight - 20) { pdf.addPage(); y = 20; }
            pdf.text(line, 14, y);
            y += 5;
        }

        if (y > pageHeight - 16) { pdf.addPage(); y = 20; }
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.text("Organizational summary generated from caregiver-provided records. Not medical advice.", 14, pageHeight - 10);

        pdf.save(`${selected.name.replace(/\s+/g, "_")}_visit_briefing.pdf`);
    }, [summary, selected]);

    return (
        <div className="pb-32 w-full max-w-lg mx-auto space-y-5 px-5 pt-5">
            {limitMessage && <LimitModal message={limitMessage} onClose={() => setLimitMessage(null)} />}
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <ArrowLeft size={20} className="text-slate-700" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <Stethoscope size={20} className="text-blue-600" />
                        {t("visitSummary.title", "Doctor Visit Summary")}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                        {t("visitSummary.subtitle", "A one-page AI briefing to carry into the appointment")}
                    </p>
                </div>
            </div>

            {/* Step 1 — choose family member */}
            {!summary && (
                <>
                    <div className="space-y-2">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                            {t("visitSummary.whoIsVisiting", "Who has the appointment?")}
                        </h2>
                        {loadingMembers ? (
                            <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
                        ) : members.length === 0 ? (
                            <button onClick={() => navigate("/patients?add=true")} className="w-full p-5 rounded-2xl bg-blue-50 border border-blue-100 text-left">
                                <p className="text-sm font-bold text-blue-700">{t("visitSummary.noMembers", "No family members yet")}</p>
                                <p className="text-xs text-blue-600/80 mt-1">{t("visitSummary.addFirst", "Add a family member profile first, then come back here.")}</p>
                            </button>
                        ) : (
                            members.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setSelected(selected?.id === m.id ? null : m)}
                                    className={`w-full p-4 rounded-2xl border flex items-center gap-3 text-left transition-all ${
                                        selected?.id === m.id
                                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20"
                                            : "bg-white border-slate-200 hover:border-blue-300"
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${selected?.id === m.id ? "bg-white/20" : "bg-slate-100"}`}>
                                        {m.photoURL
                                            ? <img src={m.photoURL} alt="" className="w-full h-full object-cover" />
                                            : <UserIcon size={18} className={selected?.id === m.id ? "text-white" : "text-slate-400"} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate">{m.name}</p>
                                        <p className={`text-xs ${selected?.id === m.id ? "text-blue-100" : "text-slate-400"}`}>
                                            {m.relationship || ""} {m.dob ? `· ${calcAge(m.dob)} ${t("visitSummary.yrs", "yrs")}` : ""}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className={selected?.id === m.id ? "text-white" : "text-slate-300"} />
                                </button>
                            ))
                        )}
                    </div>

                    {/* Step 2 — optional context + language + generate */}
                    {selected && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    {t("visitSummary.reasonLabel", "Reason for the visit (optional)")}
                                </label>
                                <input
                                    value={visitReason}
                                    onChange={e => setVisitReason(e.target.value)}
                                    placeholder={t("visitSummary.reasonPlaceholder", "e.g. follow-up for diabetes, new chest pain…")}
                                    className="mt-1.5 w-full p-3.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
                                    maxLength={200}
                                />
                            </div>

                            {showLangToggle && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                        {t("visitSummary.language", "Language")}
                                    </span>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => setOutputLang("en")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${outputLang === "en" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                                            English
                                        </button>
                                        <button onClick={() => setOutputLang("ui")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${outputLang === "ui" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                                            {uiLang?.nativeName}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => generate(selected)}
                                disabled={generating}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all disabled:opacity-70"
                            >
                                {generating
                                    ? <><Loader2 size={16} className="animate-spin" /> {t("visitSummary.generating", "Reading records and preparing the briefing…")}</>
                                    : <><Sparkles size={16} /> {t("visitSummary.generate", "Generate Briefing")}</>}
                            </button>
                            {error && <p className="text-xs font-bold text-rose-600 text-center">{error}</p>}
                        </div>
                    )}
                </>
            )}

            {/* Step 3 — result */}
            {summary && selected && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 prose prose-sm prose-slate max-w-none prose-headings:text-blue-700 prose-headings:text-base prose-headings:font-black prose-headings:mt-5 prose-headings:mb-2">
                        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{summary}</ReactMarkdown>
                    </div>

                    <div className="flex items-start gap-2 px-1">
                        <ShieldAlert size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            {t("visitSummary.disclaimer", "This is an organizational summary of your own records — not medical advice. Always rely on your doctor's judgment.")}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={downloadPDF} className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                            <FileDown size={16} /> {t("visitSummary.downloadPdf", "Download PDF")}
                        </button>
                        <button
                            onClick={() => { setSummary(null); }}
                            className="px-5 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                        >
                            <RefreshCw size={15} /> {t("visitSummary.regenerate", "New")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
