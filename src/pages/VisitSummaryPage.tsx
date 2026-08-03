import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { callGeminiDirect, extractGeminiText, isMonthlyLimitError, isAIBusyError } from "@/lib/gemini";
import { usePlanLimits } from "@/lib/planLimits";
import { LimitModal } from "@/components/LimitModal";
import { VoiceReadButton } from "@/components/VoiceButton";
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
            const [docsSnap, vitalsSnap, profileSnap] = await Promise.all([
                getDocs(query(collection(db, "documents"), where("userId", "==", user.uid), where("patientId", "==", member.id))),
                getDocs(query(collection(db, "vitals"), where("userId", "==", user.uid), where("patientId", "==", member.id))),
                getDoc(doc(db, "patients", member.id)),
            ]);

            const profile = profileSnap.exists() ? profileSnap.data() : member;

            // Data hygiene: failed analyses and error-text "summaries" must never
            // reach the AI as medical findings (legacy docs stored errors there)
            const looksLikeError = (s: string) =>
                /request too large|upload failed|not available for this file|please try again|error/i.test(s);
            const docs = docsSnap.docs
                .map(d => d.data())
                .filter(d => d.status !== "failed")
                .sort((a, b) => (b.docDate || "").localeCompare(a.docDate || ""))
                .slice(0, 20)
                .map(d => {
                    const summary = (d.aiSummary || (d.aiSummaries && Object.values(d.aiSummaries)[0]) || "") as string;
                    return {
                        name: d.name, date: d.docDate || "", category: d.category || d.docType || "",
                        doctor: d.doctorName || "", hospital: d.hospital || d.lab || "",
                        findings: looksLikeError(summary) ? "" : summary.slice(0, 800),
                    };
                });

            const vitals = vitalsSnap.docs
                .map(d => d.data())
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                .slice(0, 40)
                .map(v => ({
                    type: v.type, value: v.value, unit: v.unit,
                    date: v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000).toISOString().split("T")[0] : "",
                }));

            const langName = outputLang === "ui" && uiLang ? uiLang.name : "English";

            const prompt = `You are an experienced clinical assistant preparing a one-page pre-appointment briefing for a doctor visit in India. A busy doctor must grasp everything in under 60 seconds by SCANNING — so the output must be tightly structured as short bullet points, NEVER paragraphs. The patient's family also reads it, so keep wording plain.

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
${visitReason.trim() ? `REASON FOR THIS VISIT (stated by the caregiver): ${visitReason.trim()}` : "REASON FOR THIS VISIT: not stated — treat this as a general check-up briefing."}

## RELEVANCE — think like a clinician before writing
- The REASON FOR THIS VISIT decides what belongs. Lead with everything related to the visit reason. Always include the safety basics a doctor needs regardless (allergies, chronic conditions, CURRENT medications with doses — they matter for drug interactions even in an unrelated visit).
- Old, resolved or clearly unrelated issues: at most ONE short bullet under "Other Background", or omit. A throat infection last year does not belong in a skin-treatment briefing.
- Documents with empty findings, duplicates, or the same event repeated: merge or skip. NEVER quote error text, file names or "too large to display" content.

## OUTPUT FORMAT — write in ${langName}. Use ONLY these sections that have real content, in this order. Every section body MUST be bullet points ("- "), never paragraphs. Keep each bullet under ~18 words.

## Snapshot
- One bullet: age, sex, blood group, and standing conditions in a single line.

## Reason for Visit
- One bullet stating why they are seeing the doctor (skip this whole section if not stated).

## Current Medications & Allergies
- One bullet per medicine: "MedicineName (dose) — timing" (keep names in English).
- Allergies on their own bullet, starting with "Allergy: ".

## Relevant Findings
- One bullet per finding, newest first. EXACT format: "DD Mon YYYY — Source: finding with the key value". Example: "12 May 2026 — Dr. Sharma (Skin Clinic): diagnosed fungal infection, prescribed clotrimazole cream."
- Include real dates and exact values. No vague phrases. Only findings relevant to the visit reason plus critical background.

## Other Background
- Only if needed: at most 2 short bullets for unrelated but notable past history. Otherwise omit this section.

## Vitals
- Only if readings exist. One bullet per type: "Type: value unit (DD Mon YYYY)". Note a trend only if clear.

## Questions to Ask the Doctor
- 3 to 4 sharp, specific questions as bullets, grounded in the data above.

## RULES
- BULLETS ONLY inside every section. Absolutely no paragraph blocks anywhere.
- OMIT any section with nothing real. Never write "no data", "none available" or filler.
- Facts only — never invent values, dates or diagnoses. Convert any date to "DD Mon YYYY".
- Start directly with "## Snapshot". No preamble, no closing remarks. Under 400 words.
- This is an organizational summary, not medical advice.`;

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
            } else if (isAIBusyError(e)) {
                setError(t("common.aiBusy", "The AI is very busy right now. Your document is saved — please try the summary again in a minute."));
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
        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();
        const M = 16;                 // page margin
        const maxW = W - M * 2;
        const LH = 5.2;               // body line height
        const FOOTER_Y = H - 14;
        let y = 0;

        // ── Header band ──
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 0, W, 30, "F");
        pdf.setTextColor(255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(17);
        pdf.text("Doctor Visit Briefing", M, 14);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        const age = calcAge(selected.dob);
        const sub = [selected.name, age ? `${age} yrs` : "", selected.gender || "", selected.bloodGroup ? `Blood ${selected.bloodGroup}` : ""]
            .filter(Boolean).join("  ·  ");
        pdf.text(sub, M, 21);
        pdf.setFontSize(8);
        pdf.text(`Prepared ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · I M Smrti`, M, 26.5);
        y = 40;

        const ensure = (need: number) => { if (y + need > FOOTER_Y - 4) { pdf.addPage(); y = 20; } };

        // Build styled runs from a line: honour **bold**, else bold the leading
        // label/date (text before the first " — " or ": ") for scannability.
        const makeRuns = (text: string): Array<{ t: string; b: boolean }> => {
            if (text.includes("**")) {
                const runs: Array<{ t: string; b: boolean }> = [];
                let bold = false;
                for (const part of text.split("**")) {
                    if (part) runs.push({ t: part, b: bold });
                    bold = !bold;
                }
                return runs;
            }
            const m = text.match(/^(.{2,45}?)(\s—\s|:\s)(.*)$/);
            if (m) return [{ t: m[1], b: true }, { t: m[2] + m[3], b: false }];
            return [{ t: text, b: false }];
        };

        // Lay out styled runs with wrapping + hanging indent; returns new y
        const drawRuns = (runs: Array<{ t: string; b: boolean }>, startX: number, hangX: number) => {
            pdf.setFontSize(10);
            pdf.setTextColor(30, 41, 59);
            let cx = startX;
            const words: Array<{ w: string; b: boolean }> = [];
            for (const r of runs) r.t.split(/(\s+)/).forEach(w => { if (w) words.push({ w, b: r.b }); });
            for (const { w, b } of words) {
                pdf.setFont("helvetica", b ? "bold" : "normal");
                const ww = pdf.getTextWidth(w);
                if (cx + ww > M + maxW && w.trim()) { y += LH; ensure(LH); cx = hangX; }
                if (cx === hangX && !w.trim()) continue; // no leading space after wrap
                pdf.text(w, cx, y);
                cx += ww;
            }
            y += LH;
        };

        for (const raw of summary.split("\n")) {
            const line = raw.replace(/\s+$/, "");
            if (!line.trim()) { y += 1.5; continue; }

            const heading = line.match(/^#{1,4}\s+(.*)$/);
            if (heading) {
                y += 4; ensure(10);
                pdf.setDrawColor(224, 231, 255);
                pdf.line(M, y - 3.5, W - M, y - 3.5);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(37, 99, 235);
                pdf.text(heading[1].replace(/\*\*/g, "").replace(/[:•]/g, "").trim(), M, y);
                y += 5.5;
                continue;
            }

            const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
            if (bullet) {
                ensure(LH);
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(37, 99, 235);
                pdf.setFontSize(10);
                pdf.text("•", M + 1, y);
                drawRuns(makeRuns(bullet[1]), M + 5, M + 5);
                continue;
            }

            const num = line.match(/^\s*(\d+)\.\s+(.*)$/);
            if (num) {
                ensure(LH);
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(37, 99, 235);
                pdf.setFontSize(10);
                pdf.text(`${num[1]}.`, M + 1, y);
                drawRuns(makeRuns(num[2]), M + 7, M + 7);
                continue;
            }

            // Plain paragraph (fallback)
            ensure(LH);
            drawRuns(makeRuns(line.replace(/^\s+/, "")), M, M);
        }

        // Footer disclaimer on every page
        const pageCount = pdf.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
            pdf.setPage(p);
            pdf.setDrawColor(226, 232, 240);
            pdf.line(M, FOOTER_Y - 4, W - M, FOOTER_Y - 4);
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(7.5);
            pdf.setTextColor(120, 130, 145);
            pdf.text("AI-organised summary from your own records. Not medical advice — please confirm with the doctor.", M, FOOTER_Y);
        }

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

                    <div className="flex justify-center">
                        <VoiceReadButton text={summary} />
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
