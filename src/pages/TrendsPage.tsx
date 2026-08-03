import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { type HealthMetric, STATUS_COLOR } from "@/lib/healthData";
import { backfillDocuments, findUnextractedDocs } from "@/lib/healthBackfill";
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, ReferenceArea,
} from "recharts";
import {
    ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, Sparkles,
    User as UserIcon, ChevronRight, Activity, AlertTriangle,
} from "lucide-react";

interface Member { id: string; name: string; relationship?: string; }

/** One test's history for one patient */
interface Series {
    test: string;
    unit: string;
    points: HealthMetric[];
    latest: HealthMetric;
    direction: "up" | "down" | "flat";
    changePct: number | null;
}

export function TrendsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [members, setMembers] = useState<Member[]>([]);
    const [patientId, setPatientId] = useState<string>("");
    const [metrics, setMetrics] = useState<HealthMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingDocs, setPendingDocs] = useState(0);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeMsg, setAnalyzeMsg] = useState("");
    const [openTest, setOpenTest] = useState<string | null>(null);

    // Load family members
    useEffect(() => {
        if (!user) return;
        (async () => {
            const snap = await getDocs(query(collection(db, "patients"), where("userId", "==", user.uid)));
            const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Member[];
            setMembers(list);
            if (list.length && !patientId) setPatientId(list[0].id);
            if (!list.length) setLoading(false);
        })();
    }, [user]);

    const loadMetrics = useCallback(async () => {
        if (!user || !patientId) return;
        setLoading(true);
        try {
            const snap = await getDocs(query(
                collection(db, "health_metrics"),
                where("userId", "==", user.uid),
                where("patientId", "==", patientId),
                orderBy("date", "asc"),
            ));
            setMetrics(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as HealthMetric[]);
        } catch (e) {
            // Missing composite index falls back to an unordered read
            console.warn("Ordered metric query failed, falling back:", e);
            const snap = await getDocs(query(
                collection(db, "health_metrics"),
                where("userId", "==", user.uid),
                where("patientId", "==", patientId),
            ));
            const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as HealthMetric[];
            list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
            setMetrics(list);
        } finally {
            setLoading(false);
        }
    }, [user, patientId]);

    useEffect(() => { loadMetrics(); }, [loadMetrics]);

    // How many documents still need structuring
    useEffect(() => {
        if (!user) return;
        findUnextractedDocs(user.uid).then(d => setPendingDocs(d.length)).catch(() => undefined);
    }, [user, analyzing]);

    const series: Series[] = useMemo(() => {
        const byTest = new Map<string, HealthMetric[]>();
        for (const m of metrics) {
            if (!byTest.has(m.test)) byTest.set(m.test, []);
            byTest.get(m.test)!.push(m);
        }
        const out: Series[] = [];
        for (const [test, pts] of byTest) {
            const sorted = [...pts].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
            const latest = sorted[sorted.length - 1];
            let direction: Series["direction"] = "flat";
            let changePct: number | null = null;
            if (sorted.length >= 2) {
                const prev = sorted[sorted.length - 2].value;
                if (prev !== 0) changePct = ((latest.value - prev) / Math.abs(prev)) * 100;
                const diff = latest.value - prev;
                const threshold = Math.abs(prev) * 0.02;
                direction = diff > threshold ? "up" : diff < -threshold ? "down" : "flat";
            }
            out.push({ test, unit: latest.unit, points: sorted, latest, direction, changePct });
        }
        // Abnormal first, then most data points
        return out.sort((a, b) => {
            const aBad = a.latest.status === "high" || a.latest.status === "low" ? 0 : 1;
            const bBad = b.latest.status === "high" || b.latest.status === "low" ? 0 : 1;
            if (aBad !== bBad) return aBad - bBad;
            return b.points.length - a.points.length;
        });
    }, [metrics]);

    const runBackfill = async () => {
        if (!user || analyzing) return;
        setAnalyzing(true);
        setAnalyzeMsg(t("trends.analyzing", "Reading your past reports…"));
        try {
            const res = await backfillDocuments(user.uid, 10, (p) => {
                setAnalyzeMsg(t("trends.analyzingProgress", {
                    done: p.done, total: p.total,
                    defaultValue: "Analysed {{done}} of {{total}} reports…",
                }));
            });
            await loadMetrics();
            setAnalyzeMsg(res.quotaHit
                ? t("trends.quotaHit", "Monthly AI limit reached — the rest can be analysed next month or with Premium.")
                : t("trends.analyzeDone", { count: res.recordsCreated, defaultValue: "Found {{count}} values in your reports." }));
        } catch (e) {
            console.error(e);
            setAnalyzeMsg(t("trends.analyzeError", "Could not analyse right now. Please try again."));
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="pb-32 w-full max-w-lg mx-auto space-y-5 px-5 pt-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <ArrowLeft size={20} className="text-slate-700" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-600" />
                        {t("trends.title", "Health Trends")}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">
                        {t("trends.subtitle", "How the numbers are moving over time")}
                    </p>
                </div>
            </div>

            {/* Family member selector */}
            {members.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {members.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { setPatientId(m.id); setOpenTest(null); }}
                            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                                patientId === m.id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"
                            }`}
                        >
                            <UserIcon size={12} /> {m.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Backfill prompt */}
            {pendingDocs > 0 && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-lg shadow-blue-600/20">
                    <div className="flex items-start gap-3">
                        <Sparkles size={20} className="shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="font-black text-sm mb-1">
                                {t("trends.unlockTitle", { count: pendingDocs, defaultValue: "{{count}} reports not analysed yet" })}
                            </p>
                            <p className="text-xs text-blue-100 leading-relaxed mb-3">
                                {t("trends.unlockBody", "Let the AI read your older reports to pull out the numbers and build your trend charts.")}
                            </p>
                            <button
                                onClick={runBackfill}
                                disabled={analyzing}
                                className="px-4 py-2.5 bg-white text-blue-700 rounded-xl text-xs font-black flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-70"
                            >
                                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                {analyzing ? t("trends.analyzingShort", "Analysing…") : t("trends.unlockCta", "Analyse past reports")}
                            </button>
                            {analyzeMsg && <p className="text-[11px] text-blue-100 mt-2">{analyzeMsg}</p>}
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
            ) : series.length === 0 ? (
                <div className="text-center py-12 px-6">
                    <Activity size={30} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">{t("trends.empty", "No numbers yet")}</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {t("trends.emptyBody", "Upload a lab report — the AI pulls out every value and charts it here automatically.")}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {series.map(s => {
                        const abnormal = s.latest.status === "high" || s.latest.status === "low";
                        const color = STATUS_COLOR[s.latest.status];
                        return (
                            <button
                                key={s.test}
                                onClick={() => setOpenTest(openTest === s.test ? null : s.test)}
                                className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 transition-colors ${abnormal ? "border-rose-200" : "border-slate-200"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-sm text-slate-900 truncate">{s.test}</p>
                                            {abnormal && <AlertTriangle size={13} className="text-rose-500 shrink-0" />}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {s.points.length === 1
                                                ? t("trends.oneReading", "1 reading")
                                                : t("trends.nReadings", { count: s.points.length, defaultValue: "{{count}} readings" })}
                                            {" · "}{s.latest.date}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-lg font-black" style={{ color }}>
                                            {s.latest.value}<span className="text-[10px] font-bold text-slate-400 ml-0.5">{s.latest.unit}</span>
                                        </p>
                                        {s.changePct != null && (
                                            <p className={`text-[10px] font-black flex items-center justify-end gap-0.5 ${
                                                s.direction === "up" ? "text-rose-500" : s.direction === "down" ? "text-emerald-600" : "text-slate-400"
                                            }`}>
                                                {s.direction === "up" ? <TrendingUp size={10} /> : s.direction === "down" ? <TrendingDown size={10} /> : <Minus size={10} />}
                                                {Math.abs(s.changePct).toFixed(0)}%
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className={`text-slate-300 shrink-0 transition-transform ${openTest === s.test ? "rotate-90" : ""}`} />
                                </div>

                                {/* Expanded chart */}
                                {openTest === s.test && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        {s.points.length < 2 ? (
                                            <p className="text-xs text-slate-400 text-center py-4">
                                                {t("trends.needMore", "One more report will start the trend line.")}
                                            </p>
                                        ) : (
                                            <div className="h-44 -ml-2">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={s.points.map(p => ({ date: p.date?.slice(5) || "", value: p.value }))}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                                        {s.latest.refLow != null && s.latest.refHigh != null && (
                                                            <ReferenceArea y1={s.latest.refLow} y2={s.latest.refHigh} fill="#10b981" fillOpacity={0.08} />
                                                        )}
                                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                                                        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                                                        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                        {s.latest.refLow != null && s.latest.refHigh != null && (
                                            <p className="text-[10px] text-slate-400 text-center mt-1">
                                                {t("trends.normalRange", "Normal range")}: {s.latest.refLow}–{s.latest.refHigh} {s.unit}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-slate-400 text-center mt-2 truncate">
                                            {t("trends.source", "From")}: {s.latest.documentName}
                                        </p>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
