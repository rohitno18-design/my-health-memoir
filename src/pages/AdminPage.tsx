import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldCheck, Users, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface UserRecord {
    id: string;
    displayName: string | null;
    email: string | null;
    role: string;
}

export function AdminPage() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [docCount, setDocCount] = useState(0);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            const [usersSnap, docsSnap] = await Promise.all([
                getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"))),
                getDocs(collection(db, "documents")),
            ]);
            setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord)));
            setDocCount(docsSnap.size);
            setLoading(false);
        };
        fetchStats();
    }, []);

    const stats = [
        { label: t("admin.totalUsers"), value: users.length, icon: Users, color: "bg-blue-50 text-blue-600" },
        { label: t("admin.documents"), value: docCount, icon: FileText, color: "bg-violet-50 text-violet-600" },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="py-6 space-y-5">
            <div className="flex items-center gap-2">
                <ShieldCheck size={22} className="text-primary" />
                <h1 className="text-xl font-bold">{t("admin.dashboard")}</h1>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                {stats.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 ${color}`}>
                            <Icon size={18} />
                        </div>
                        <p className="text-xl font-bold">{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                ))}
            </div>

            {/* User list */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between p-4 text-sm font-semibold"
                >
                    {t("admin.userAccounts")}
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expanded && (
                    <div className="divide-y divide-border">
                        {users.map(u => (
                            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-xs font-bold text-primary">
                                        {(u.displayName ?? u.email ?? "U")[0].toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{u.displayName ?? "—"}</p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                                    {u.role}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
