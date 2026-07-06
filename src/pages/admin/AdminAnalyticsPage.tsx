import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    ArrowLeft, TrendingUp, Users, FileText, Star, Bot,
    Loader2, HeartPulse, UserPlus, RefreshCw, Target,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface WeekBucket { week: string; signups: number; }
interface DayUsage { date: string; calls: number; tokens: number; }
interface RecentUser { id: string; name: string; email: string; tier: string; createdAt: Date | null; }

interface Analytics {
    totalUsers: number;
    premiumUsers: number;
    totalFamilyMembers: number;
    usersWithFamily: number;      // caregiver activation
    totalDocuments: number;
    usersWithDocuments: number;   // record activation
    usersWithEmergency: number;   // emergency card activation
    totalVitals: number;
    signupsByWeek: WeekBucket[];
    aiUsage: DayUsage[];
    recentUsers: RecentUser[];
}

function weekKey(d: Date): string {
    // ISO-ish week label like "12 Jan"
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AdminAnalyticsPage() {
    const navigate = useNavigate();
    const [data, setData] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [usersSnap, patientsSnap, docsSnap, vitalsSnap, emergencySnap, aiDailySnap] = await Promise.all([
                getDocs(collection(db, "users")),
                getDocs(collection(db, "patients")),
                getDocs(collection(db, "documents")),
                getDocs(collection(db, "vitals")),
                getDocs(collection(db, "emergency_info")),
                getDocs(query(collection(db, "app_stats", "ai_usage", "daily"), orderBy("date", "desc"), limit(14))).catch(() => null),
            ]);

            // ── Users & signups timeline ──
            const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            const premiumUsers = users.filter(u => u.tier === "premium").length;

            const eightWeeksAgo = new Date();
            eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
            const buckets = new Map<string, number>();
            // Seed all 8 weeks so empty weeks still show
            for (let i = 7; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i * 7);
                buckets.set(weekKey(d), 0);
            }
            for (const u of users) {
                const created: Date | null = u.createdAt?.toDate?.() ?? (u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000) : null);
                if (created && created >= eightWeeksAgo) {
                    const key = weekKey(created);
                    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
                }
            }
            const signupsByWeek: WeekBucket[] = [...buckets.entries()].map(([week, signups]) => ({ week, signups }));

            // ── Activation funnel (the caregiver metrics that matter) ──
            const patients = patientsSnap.docs.map(d => d.data() as any);
            const familyOwners = new Set(patients.filter(p => p.relationship && p.relationship !== "Self").map(p => p.userId));
            const docOwners = new Set(docsSnap.docs.map(d => (d.data() as any).userId));
            const emergencyOwners = new Set(emergencySnap.docs.map(d => (d.data() as any).userId));

            // ── AI usage ──
            const aiUsage: DayUsage[] = aiDailySnap
                ? aiDailySnap.docs.map(d => d.data() as DayUsage).sort((a, b) => a.date.localeCompare(b.date))
                : [];

            // ── Recent signups ──
            const recentUsers: RecentUser[] = users
                .map(u => ({
                    id: u.id,
                    name: u.name || u.displayName || "—",
                    email: u.email || u.phoneNumber || "—",
                    tier: u.tier || "free",
                    createdAt: u.createdAt?.toDate?.() ?? (u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000) : null),
                }))
                .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
                .slice(0, 8);

            setData({
                totalUsers: users.length,
                premiumUsers,
                totalFamilyMembers: patients.length,
                usersWithFamily: familyOwners.size,
                totalDocuments: docsSnap.size,
                usersWithDocuments: docOwners.size,
                usersWithEmergency: emergencyOwners.size,
                totalVitals: vitalsSnap.size,
                signupsByWeek,
                aiUsage,
                recentUsers,
            });
        } catch (e: any) {
            console.error("Analytics load failed:", e);
            setError(e?.message || "Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="py-6 space-y-6 pb-32 px-4 max-w-lg mx-auto w-full">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/admin")} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-all shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-600" /> Growth Analytics
                    </h1>
                    <p className="text-xs text-muted-foreground">Live numbers for real decisions</p>
                </div>
                <button onClick={load} className="p-2.5 rounded-xl bg-card border border-border hover:bg-muted transition-colors shadow-sm">
                    <RefreshCw size={16} />
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 font-medium">{error}</div>
            )}

            {data && (
                <>
                    {/* Headline stats */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Total Users", value: data.totalUsers, icon: Users, color: "bg-blue-50 text-blue-600" },
                            { label: "Premium", value: data.premiumUsers, icon: Star, color: "bg-amber-50 text-amber-600" },
                            { label: "Family Members", value: data.totalFamilyMembers, icon: UserPlus, color: "bg-violet-50 text-violet-600" },
                            { label: "Documents", value: data.totalDocuments, icon: FileText, color: "bg-emerald-50 text-emerald-600" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="bg-card border border-border/50 shadow-sm rounded-2xl p-4">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                                    <Icon size={18} />
                                </div>
                                <p className="text-2xl font-black">{value}</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Activation funnel — the metric set that decides strategy */}
                    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Target size={16} className="text-rose-600" />
                            <h3 className="font-bold text-sm">Caregiver Activation Funnel</h3>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: "Signed up", n: data.totalUsers, denom: data.totalUsers, color: "bg-slate-400" },
                                { label: "Added a family member (not Self)", n: data.usersWithFamily, denom: data.totalUsers, color: "bg-violet-500" },
                                { label: "Uploaded ≥1 document", n: data.usersWithDocuments, denom: data.totalUsers, color: "bg-blue-500" },
                                { label: "Set up emergency card", n: data.usersWithEmergency, denom: data.totalUsers, color: "bg-rose-500" },
                                { label: "Went premium", n: data.premiumUsers, denom: data.totalUsers, color: "bg-amber-500" },
                            ].map(({ label, n, denom, color }) => (
                                <div key={label}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-foreground">{label}</span>
                                        <span className="font-black text-foreground">{n} <span className="text-muted-foreground font-medium">({pct(n, denom)}%)</span></span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct(n, denom)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
                            The "added a family member" step is the core caregiver signal — users past that step have real switching costs.
                        </p>
                    </div>

                    {/* Signups chart */}
                    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp size={16} className="text-blue-600" />
                            <h3 className="font-bold text-sm">Signups — last 8 weeks</h3>
                        </div>
                        <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.signupsByWeek} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: "rgba(59,130,246,0.06)" }} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                                    <Bar dataKey="signups" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* AI usage */}
                    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Bot size={16} className="text-purple-600" />
                            <h3 className="font-bold text-sm">AI Usage — last 14 days</h3>
                        </div>
                        {data.aiUsage.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No AI usage recorded yet. Counters begin with the next AI call.</p>
                        ) : (
                            <>
                                <div className="flex gap-6 mb-3">
                                    <div>
                                        <p className="text-xl font-black">{data.aiUsage.reduce((a, d) => a + (d.calls || 0), 0)}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Calls</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-black">{(data.aiUsage.reduce((a, d) => a + (d.tokens || 0), 0) / 1000).toFixed(1)}k</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Tokens</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-black">₹{(data.aiUsage.reduce((a, d) => a + (d.tokens || 0), 0) / 1000000 * 8).toFixed(2)}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Est. cost</p>
                                    </div>
                                </div>
                                <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.aiUsage} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                            <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(5)} />
                                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                                            <Bar dataKey="calls" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Engagement snapshot */}
                    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <HeartPulse size={16} className="text-emerald-600" />
                            <h3 className="font-bold text-sm">Engagement Snapshot</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-3 rounded-xl bg-muted/50">
                                <p className="text-lg font-black">{data.totalUsers > 0 ? (data.totalFamilyMembers / data.totalUsers).toFixed(1) : "0"}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Members / user</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/50">
                                <p className="text-lg font-black">{data.usersWithDocuments > 0 ? (data.totalDocuments / data.usersWithDocuments).toFixed(1) : "0"}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Docs / active</p>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/50">
                                <p className="text-lg font-black">{data.totalVitals}</p>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Vitals logged</p>
                            </div>
                        </div>
                    </div>

                    {/* Recent signups */}
                    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <UserPlus size={16} className="text-blue-600" />
                            <h3 className="font-bold text-sm">Recent Signups</h3>
                        </div>
                        <div className="space-y-2">
                            {data.recentUsers.map(u => (
                                <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{u.name}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${u.tier === "premium" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{u.tier}</span>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{u.createdAt ? u.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
