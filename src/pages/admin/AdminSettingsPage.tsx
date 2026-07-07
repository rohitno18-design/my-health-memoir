import { useState, useEffect } from "react";
import { ArrowLeft, ToggleLeft, ToggleRight, ServerCrash, RefreshCw, SlidersHorizontal, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_LIMITS, type PlanLimits } from "@/lib/planLimits";

interface FeatureFlags {
    aiChatEnabled: boolean;
    documentAnalysisEnabled: boolean;
    emergencyPulseEnabled: boolean;
    newRegistrationsEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
    aiChatEnabled: true,
    documentAnalysisEnabled: true,
    emergencyPulseEnabled: true,
    newRegistrationsEnabled: true,
};

interface AuditEntry {
    id: string;
    userId: string;
    action: string;
    details: string;
    timestamp: Timestamp | null;
}

export function AdminSettingsPage() {
    const navigate = useNavigate();
    const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const [planLimits, setPlanLimits] = useState<PlanLimits>(DEFAULT_LIMITS);
    const [limitsSaving, setLimitsSaving] = useState(false);
    const [limitsSaved, setLimitsSaved] = useState(false);

    useEffect(() => {
        loadFeatureFlags();
        loadPlanLimits();
    }, []);

    const loadPlanLimits = async () => {
        try {
            const snap = await getDoc(doc(db, "app_config", "plan_limits"));
            if (snap.exists()) setPlanLimits({ ...DEFAULT_LIMITS, ...snap.data() });
        } catch (e) {
            console.error("Failed to load plan limits:", e);
        }
    };

    const savePlanLimits = async () => {
        setLimitsSaving(true);
        setLimitsSaved(false);
        try {
            await setDoc(doc(db, "app_config", "plan_limits"), planLimits, { merge: true });
            setLimitsSaved(true);
            setTimeout(() => setLimitsSaved(false), 2500);
        } catch (e) {
            console.error("Failed to save plan limits:", e);
            alert("Failed to save plan limits");
        } finally {
            setLimitsSaving(false);
        }
    };

    const loadFeatureFlags = async () => {
        try {
            const snap = await getDoc(doc(db, "app_config", "feature_flags"));
            if (snap.exists()) {
                setFlags({ ...DEFAULT_FLAGS, ...snap.data() });
            }
        } catch (e) {
            console.error("Failed to load feature flags:", e);
        } finally {
            setLoading(false);
        }
    };

    const toggleFlag = async (key: keyof FeatureFlags) => {
        const newValue = !flags[key];
        setSaving(key);
        const updated = { ...flags, [key]: newValue };
        setFlags(updated);
        try {
            await setDoc(doc(db, "app_config", "feature_flags"), updated, { merge: true });
        } catch (e) {
            setFlags(flags);
            console.error("Failed to save feature flag:", e);
        } finally {
            setSaving(null);
        }
    };

    const loadAuditLogs = async () => {
        setAuditLoading(true);
        try {
            const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(50));
            const snap = await getDocs(q);
            const logs: AuditEntry[] = [];
            snap.forEach((d) => {
                logs.push({ id: d.id, ...d.data() } as AuditEntry);
            });
            setAuditLogs(logs);
        } catch (e) {
            console.error("Failed to load audit logs:", e);
        } finally {
            setAuditLoading(false);
        }
    };

    return (
        <div className="py-6 space-y-6 pb-32 px-4 relative max-w-lg mx-auto w-full">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate("/admin")}
                    className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-all shadow-sm"
                >
                    <ArrowLeft size={20} className="text-foreground" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold tracking-tight">System & AI</h1>
                </div>
            </div>

            {/* Feature Flags */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
                        <ToggleLeft size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Feature Flags</h3>
                </div>
                {loading ? (
                    <p className="text-sm text-muted-foreground pl-11">Loading...</p>
                ) : (
                    <div className="space-y-2 pl-11">
                        {[
                            { key: "aiChatEnabled" as const, label: "AI Chat", icon: "💬" },
                            { key: "documentAnalysisEnabled" as const, label: "Document Analysis", icon: "📄" },
                            { key: "emergencyPulseEnabled" as const, label: "Emergency Pulse", icon: "🚨" },
                            { key: "newRegistrationsEnabled" as const, label: "New Registrations", icon: "👤" },
                        ].map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => toggleFlag(key)}
                                disabled={saving === key}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-50"
                            >
                                <span className="flex items-center gap-2 text-sm">
                                    <span>{icon}</span> {label}
                                </span>
                                {flags[key] ? (
                                    <ToggleRight size={24} className="text-blue-500" />
                                ) : (
                                    <ToggleLeft size={24} className="text-muted-foreground" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Plan Limits — freemium tier configuration, live without redeploys */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                        <SlidersHorizontal size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Plan Limits</h3>
                </div>
                <p className="text-xs text-muted-foreground pl-11 mb-4">Free-tier caps take effect immediately for all users. Set a monthly value to -1 for unlimited.</p>
                <div className="pl-11 space-y-3">
                    {([
                        ["freeMaxPatients", "Free: family member profiles (total)"],
                        ["freeMaxDocuments", "Free: documents (total)"],
                        ["freeDocSummariesPerMonth", "Free: AI report summaries / month"],
                        ["freeVisitBriefingsPerMonth", "Free: doctor visit briefings / month"],
                        ["premiumMaxDocuments", "Premium: document ceiling (hidden abuse guard)"],
                    ] as Array<[keyof PlanLimits, string]>).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between gap-3">
                            <label htmlFor={`limit-${key}`} className="text-sm text-foreground flex-1">{label}</label>
                            <input
                                id={`limit-${key}`}
                                type="number"
                                value={planLimits[key]}
                                min={-1}
                                onChange={e => setPlanLimits(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                className="w-24 p-2.5 rounded-xl bg-muted/50 border border-border text-sm font-bold text-center focus:outline-none focus:border-blue-400"
                            />
                        </div>
                    ))}
                    <button
                        onClick={savePlanLimits}
                        disabled={limitsSaving}
                        className="w-full mt-2 py-3 bg-slate-900 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
                    >
                        {limitsSaving ? <RefreshCw size={14} className="animate-spin" />
                            : limitsSaved ? <><Check size={15} /> Saved</>
                            : "Save Plan Limits"}
                    </button>
                </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
                        <ServerCrash size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Audit Logs</h3>
                    <button
                        onClick={loadAuditLogs}
                        disabled={auditLoading}
                        className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={auditLoading ? "animate-spin" : ""} />
                    </button>
                </div>
                {auditLogs.length === 0 && !auditLoading ? (
                    <p className="text-sm text-muted-foreground pl-11">No logs loaded. Tap refresh to load.</p>
                ) : auditLoading ? (
                    <p className="text-sm text-muted-foreground pl-11">Loading logs...</p>
                ) : (
                    <div className="pl-11 space-y-2 max-h-80 overflow-y-auto">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="text-xs border-l-2 border-muted pl-3 py-1">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{log.action}</span>
                                    <span>{log.timestamp?.toDate?.()?.toLocaleString?.() ?? "—"}</span>
                                </div>
                                <p className="text-foreground mt-0.5">{log.details}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
