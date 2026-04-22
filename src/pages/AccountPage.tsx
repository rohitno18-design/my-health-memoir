import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
    Camera, User, Mail, Lock, ChevronRight,
    Check, Loader2, LogOut, Pencil, ShieldCheck,
    Calendar, Droplets, UserCircle, AlertTriangle, X,
    Bell, Share2, Sparkles, CheckCircle2, RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    doc, updateDoc, collection, getDocs
} from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/firebase";


interface UserSettings {
    notifAppointments: boolean;
    notifHealthTips: boolean;
    notifAIInsights: boolean;
    privacyShowProfile: boolean;
    privacyDataSharing: boolean;
}

type Section = "info" | "security" | "settings";

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 3500);
        return () => clearTimeout(t);
    }, [onDismiss]);
    return (
        <div className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium max-w-xs w-full",
            type === "success" ? "bg-green-600 text-white" : "bg-destructive text-white"
        )}>
            {type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span className="flex-1">{message}</span>
            <button onClick={onDismiss}><X size={14} /></button>
        </div>
    );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ photoURL, displayName, size = "lg", onClick }: {
    photoURL?: string | null;
    displayName?: string | null;
    size?: "sm" | "lg";
    onClick?: () => void;
}) {
    const { t } = useTranslation();
    const dim = size === "lg" ? "w-24 h-24 text-3xl" : "w-10 h-10 text-base";
    if (photoURL) {
        return (
            <img
                src={photoURL}
                alt={displayName ?? t("dashboard.guest")}
                onClick={onClick}
                className={cn("rounded-full object-cover cursor-pointer ring-4 ring-primary/20", dim)}
            />
        );
    }
    return (
        <div onClick={onClick} className={cn("rounded-full bg-primary/10 flex items-center justify-center cursor-pointer ring-4 ring-primary/20 font-bold text-primary", dim)}>
            {(displayName ?? "U")[0].toUpperCase()}
        </div>
    );
}

// ─── EditableField ────────────────────────────────────────────────────────────
function EditableField({
    label, value, icon: Icon, onSave, type = "text", placeholder,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    onSave: (v: string) => Promise<void>;
    type?: string;
    placeholder?: string;
}) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    useEffect(() => {
        if (!editing) setVal(value);
    }, [value, editing]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError("");
        try {
            await onSave(val);
            setEditing(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("account.errUpdateFailed");
            setSaveError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        setVal(value);
        setSaveError("");
    };

    return (
        <div className="py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    {editing ? (
                        <input
                            autoFocus
                            type={type}
                            value={val}
                            onChange={e => setVal(e.target.value)}
                            placeholder={placeholder}
                            className="w-full mt-0.5 text-sm bg-secondary rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    ) : (
                        <p className="text-sm font-medium truncate">{value || <span className="text-muted-foreground italic text-xs uppercase font-bold tracking-widest">{t("common.notSet")}</span>}</p>
                    )}
                </div>
                {editing ? (
                    <div className="flex gap-1 flex-shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <button onClick={() => { setEditing(true); setSaveError(""); }} className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil size={14} />
                    </button>
                )}
            </div>
            {saveError && (
                <div className="mt-1.5 ml-11 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle size={11} />
                    {saveError}
                </div>
            )}
        </div>
    );
}

// ─── GenderSelect ─────────────────────────────────────────────────────────────
function GenderSelect({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
    const { t } = useTranslation();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [local, setLocal] = useState(value);

    useEffect(() => { setLocal(value); }, [value]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        setLocal(v);
        setSaving(true); setError(""); setSaved(false);
        try {
            await onSave(v);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-3 py-3 last:border-0 border-b border-border">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User size={15} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
                <p className="text-[11px] text-muted-foreground">{t("account.gender")}</p>
                <select
                    value={local}
                    onChange={handleChange}
                    disabled={saving}
                    className="mt-0.5 text-sm font-medium bg-transparent focus:outline-none w-full disabled:opacity-60"
                >
                    <option value="">{t("common.notSpecified")}</option>
                    <option value="Male">{t("common.male")}</option>
                    <option value="Female">{t("common.female")}</option>
                    <option value="Other">{t("common.other")}</option>
                    <option value="Prefer not to say">{t("common.preferNotToSay")}</option>
                </select>
                {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
            </div>
            {saving && <Loader2 size={14} className="animate-spin text-muted-foreground flex-shrink-0" />}
            {saved && <Check size={14} className="text-green-600 flex-shrink-0" />}
        </div>
    );
}

// ─── ChangePasswordModal ──────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { updateUserPassword, logSecurityActivity } = useAuth();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (next !== confirm) { setError(t("account.errPasswordMatch")); return; }
        if (next.length < 6) { setError(t("account.errPasswordLength")); return; }
        setError(""); setSaving(true);
        try {
            await updateUserPassword(current, next);
            await logSecurityActivity("PASSWORD_CHANGE", "••••••••", "Updated", { refreshed: true });
            setDone(true);
            setTimeout(onClose, 1500);
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setError(t("account.errCurrentPassword"));
            } else if (code === "auth/too-many-requests") {
                setError(t("account.errTooMany"));
            } else {
                setError(t("account.errUpdateFailed"));
            }
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold">{t("account.changePassword")}</h2>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                {done ? (
                    <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                            <Check size={22} className="text-green-600" />
                        </div>
                        <p className="font-medium text-sm">{t("account.msgPasswordUpdated")}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2.5 flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
                        {[
                            { label: t("account.currentPassword"), val: current, set: setCurrent },
                            { label: t("account.newPassword"), val: next, set: setNext },
                            { label: t("account.confirmPassword"), val: confirm, set: setConfirm },
                        ].map(({ label, val, set }) => (
                            <div key={label}>
                                <label className="block text-xs font-medium mb-1">{label}</label>
                                <input type="password" value={val} onChange={e => set(e.target.value)} required
                                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                            </div>
                        ))}
                        <button type="submit" disabled={saving}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {t("account.updateBtn")}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── ChangeEmailModal ─────────────────────────────────────────────────────────
function ChangeEmailModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
    const { t } = useTranslation();
    const { user, userProfile, updateUserEmail, logSecurityActivity, refreshUser } = useAuth();
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [refreshing, setRefreshing] = useState(true);

    useEffect(() => {
        (async () => {
            try { await refreshUser(); } catch (e) { console.error(e); } finally { setRefreshing(false); }
        })();
    }, []);

    const authEmail = user?.email || "";
    const pendingEmail = (userProfile as any)?.pendingEmail || null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSaving(true);
        try {
            await updateUserEmail(newEmail, password);
            const currentAuthEmail = user?.email || authEmail;
            await logSecurityActivity("EMAIL_CHANGE_REQUESTED", currentAuthEmail, newEmail, {
                status: "pending_verification",
                message: `Verification link sent to ${newEmail}. Security alert sent to ${currentAuthEmail}.`
            });
            setDone(true);
            onSuccess(t("account.msgVerificationSent", { email: newEmail }));
        } catch (err: unknown) {
            console.error(err);
            const msg = err instanceof Error ? err.message : String(err);
            const code = (err as { code?: string })?.code;
            if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
                setError(t("account.errCurrentPassword"));
            } else if (code === "auth/email-already-in-use") {
                setError(t("account.errEmailUsed"));
            } else if (code === "auth/requires-recent-login") {
                setError(t("account.errTimeout"));
            } else {
                setError(t("account.errUpdateFailed") + ": " + msg);
            }
        } finally { setSaving(false); }
    };

    if (refreshing) return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold">{t("account.changeEmail")}</h2>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                {done ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto"><Mail size={32} className="text-blue-600" /></div>
                        <p className="font-bold text-lg">{t("account.done")}</p>
                        <p className="text-sm text-muted-foreground leading-snug">{t("account.msgVerificationSent", { email: newEmail })}</p>
                        <button onClick={onClose} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">{t("common.ok")}</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2.5 flex items-center gap-2"><AlertTriangle size={13} /> {error}</div>}
                        {pendingEmail && <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">⏳ {t("account.pendingChange", { email: pendingEmail })}</div>}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">⚠️ {t("account.securityWarning")}</div>
                        <div>
                            <label className="block text-xs font-medium mb-1">{t("account.newEmail")}</label>
                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1">{t("account.currentPassword")}</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                                className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <button type="submit" disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            {t("account.updateBtn")}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}


// ─── DeleteAccountModal ────────────────────────────────────────────────────────
function DeleteAccountModal({ onClose }: { onClose: () => void }) {
    const { deleteAccount } = useAuth();
    const navigate = useNavigate();
    const [confirmText, setConfirmText] = useState("");
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmText !== "DELETE") {
            setError("Please type DELETE to confirm");
            return;
        }
        setError(""); setDeleting(true);
        try {
            await deleteAccount();
            navigate("/login");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/requires-recent-login") {
                setError("Security require you to manually log out and log back in before deleting your account.");
            } else {
                setError(err instanceof Error ? err.message : "Failed to delete account");
            }
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="w-full max-w-lg glass-card border border-white/50 backdrop-blur-xl rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl relative z-10" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-destructive">Delete Account</h2>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-sm mb-4">
                    <p className="font-bold mb-2">Warning: This action is irreversible.</p>
                    <p>All your medical records, personal data, and emergency contacts will be permanently deleted and cannot be recovered.</p>
                </div>
                {error && <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-2 flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
                
                <div>
                    <label className="block text-xs font-medium mb-1">Type "DELETE" to confirm</label>
                    <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-destructive/50 focus:border-destructive bg-background text-sm focus:outline-none" />
                </div>
                <button onClick={handleDelete} disabled={deleting || confirmText !== "DELETE"}
                    className="w-full py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                    {deleting && <Loader2 size={14} className="animate-spin" />}
                    Permanently Delete Account
                </button>
            </div>
        </div>
    );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" onClick={() => onChange(!checked)}
            className={cn("relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0", checked ? "bg-primary" : "bg-muted")}>
            <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-5" : "translate-x-0")} />
        </button>
    );
}

// ─── SettingsSection ──────────────────────────────────────────────────────────
function SettingsSection({ userId, initialSettings }: { userId?: string; initialSettings?: UserSettings }) {
    const { t } = useTranslation();
    const defaults: UserSettings = { notifAppointments: true, notifHealthTips: true, notifAIInsights: false, privacyShowProfile: true, privacyDataSharing: false };
    const [settings, setSettings] = useState<UserSettings>({ ...defaults, ...initialSettings });
    const [saving, setSaving] = useState<string | null>(null);

    const handleToggle = async (key: keyof UserSettings, value: boolean) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        if (!userId) return;
        setSaving(key);
        try { await updateDoc(doc(db, "users", userId), { settings: next }); } catch (err) { setSettings(settings); } finally { setSaving(null); }
    };

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-[1.5rem] divide-y divide-white/40 overflow-hidden shadow-sm border border-white/50">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest p-4 pb-2">{t("account.notifications")}</p>
                {[
                    { key: "notifHealthTips" as const, icon: Sparkles, label: t("account.healthTips"), sub: t("account.healthTipsSub"), color: "bg-amber-50 text-amber-600" },
                    { key: "notifAIInsights" as const, icon: Bell, label: t("account.aiInsights"), sub: t("account.aiInsightsSub"), color: "bg-violet-50 text-violet-600" },
                ].map(({ key, icon: Icon, label, sub, color }) => (
                    <div key={key} className="flex items-center gap-3 p-4">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}><Icon size={17} /></div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-900">{label}</p>
                            <p className="text-[10px] text-slate-500 font-bold leading-tight">{sub}</p>
                        </div>
                        {saving === key ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Toggle checked={settings[key]} onChange={v => handleToggle(key, v)} />}
                    </div>
                ))}
            </div>
            <div className="glass-card rounded-[1.5rem] divide-y divide-white/40 overflow-hidden shadow-sm border border-white/50">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest p-4 pb-2">{t("account.privacy")}</p>
                {[
                    { key: "privacyDataSharing" as const, icon: Share2, label: t("account.dataSharing"), sub: t("account.dataSharingSub"), color: "bg-rose-50 text-rose-600" },
                ].map(({ key, icon: Icon, label, sub, color }) => (
                    <div key={key} className="flex items-center gap-3 p-4">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}><Icon size={17} /></div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-900">{label}</p>
                            <p className="text-[10px] text-slate-500 font-bold leading-tight">{sub}</p>
                        </div>
                        {saving === key ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Toggle checked={settings[key]} onChange={v => handleToggle(key, v)} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── SecurityHistory ──────────────────────────────────────────────────────────
function SecurityHistory({ userId }: { userId: string }) {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const colRef = collection(db, "users", userId, "securityLogs");
            const snap = await getDocs(colRef);
            const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setLogs(rawLogs.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    useEffect(() => { fetchLogs(); }, [userId]);

    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin" size={16} /></div>;

    return (
        <div className="glass-card rounded-[1.5rem] p-5 shadow-sm border border-white/50 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest"><ShieldCheck size={14} /> {t("account.recentActivity")}</div>
                <button onClick={fetchLogs}><RefreshCw size={12} className="text-slate-400" /></button>
            </div>
            {logs.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">{t("account.noActivity")}</p> : (
                <div className="space-y-3">
                    {logs.map(log => (
                        <div key={log.id} className="border-l-2 border-slate-100 pl-4 py-0.5">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{log.type.replace("_", " ")}</p>
                            <p className="text-xs font-bold text-slate-700 mt-1">{log.newValue}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold">{log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleDateString() : ""}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── AccountPage ──────────────────────────────────────────────────────────────
export function AccountPage() {
    const { user, userProfile, logout, refreshUser, updateUserProfile, uploadProfilePhoto } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [section, setSection] = useState<Section>("info");
    const [photoUploading, setPhotoUploading] = useState(false);
    const [showPwModal, setShowPwModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const h = async () => { if (document.visibilityState === "visible" && user?.uid) await refreshUser().catch(e => console.error(e)); };
        h(); document.addEventListener("visibilitychange", h);
        return () => document.removeEventListener("visibilitychange", h);
    }, [user?.uid]);

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setPhotoUploading(true);
        try {
            const url = await uploadProfilePhoto(file);
            await updateUserProfile({ photoURL: url });
            setToast({ message: t("account.msgPhotoUpdated"), type: "success" });
        } catch (err) { setToast({ message: t("account.errUpdateFailed"), type: "error" }); } finally { setPhotoUploading(false); }
    };

    const handleProfileSave = async (data: any) => {
        try { await updateUserProfile(data); setToast({ message: t("account.msgSaved"), type: "success" }); }
        catch (err) { throw new Error(t("account.errUpdateFailed")); }
    };

    const handleSignOut = async () => { await logout(); navigate("/login"); };

    return (
        <div className="pb-32">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            {/* Header / Profile Info */}
            <header className="bg-white border-b border-slate-100 px-6 pt-10 pb-24 relative overflow-hidden">
                 <div className="absolute top-0 right-0 size-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                 
                 <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{t("account.title")}</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{t("account.subtitle")}</p>
                    </div>
                    <button onClick={handleSignOut} className="p-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100"><LogOut size={18} /></button>
                 </div>

                 <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <Avatar photoURL={userProfile?.photoURL} displayName={userProfile?.displayName} size="lg" />
                        <label className="absolute -bottom-1 -right-1 size-8 bg-slate-900 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-lg active:scale-90 transition-transform">
                            {photoUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handlePhotoChange} disabled={photoUploading} />
                        </label>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-slate-900 leading-tight mb-1">{userProfile?.displayName || t("dashboard.guest")}</h2>
                        <p className="text-xs font-bold text-slate-400">{user?.email}</p>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "65%" }} />
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("account.profileComplete")}</span>
                        </div>
                    </div>
                 </div>
            </header>

            <main className="px-6 -mt-12 relative z-20 space-y-8">
                {/* Global Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => navigate("/patients")} className="bg-slate-900 text-white p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95 transition-transform">
                        <UserCircle size={28} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t("account.managePatients")}</span>
                    </button>
                    <button onClick={() => navigate("/docs")} className="bg-white text-slate-900 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
                        <RefreshCw size={28} className="text-slate-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t("account.myDocs")}</span>
                    </button>
                </div>

                {/* Section Nav */}
                <div className="flex bg-slate-200/50 p-1 rounded-2xl">
                    {[
                        { id: "info", label: t("account.personalInfo"), icon: User },
                        { id: "security", label: t("account.security"), icon: Lock },
                        { id: "settings", label: t("account.settings"), icon: Bell },
                    ].map(s => (
                        <button key={s.id} onClick={() => setSection(s.id as Section)}
                            className={cn("flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all",
                                section === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>
                            <s.icon size={18} strokeWidth={section === s.id ? 2.5 : 2} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{s.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="pb-10">
                    {section === "info" && (
                        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-1">
                            <EditableField label={t("account.fullName")} icon={User} value={userProfile?.displayName ?? ""} onSave={v => handleProfileSave({ displayName: v })} />
                            <EditableField label={t("account.dob")} icon={Calendar} value={userProfile?.dob ?? ""} type="date" onSave={v => handleProfileSave({ dob: v })} />
                            <EditableField label={t("account.bloodGroup")} icon={Droplets} value={userProfile?.bloodGroup ?? ""} onSave={v => handleProfileSave({ bloodGroup: v })} />
                            <GenderSelect value={userProfile?.gender ?? ""} onSave={v => handleProfileSave({ gender: v })} />
                        </div>
                    )}

                    {section === "security" && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-[2rem] overflow-hidden divide-y divide-slate-50 shadow-sm border border-slate-100">
                                <button onClick={() => setShowEmailModal(true)} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="size-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Mail size={18} /></div>
                                        <div className="text-left font-lexend">
                                            <p className="text-sm font-black uppercase tracking-tight text-slate-900">{t("account.changeEmail")}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1">{user?.email}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </button>

                                <button onClick={() => setShowPwModal(true)} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="size-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><Lock size={18} /></div>
                                        <div className="text-left font-lexend">
                                            <p className="text-sm font-black uppercase tracking-tight text-slate-900">{t("account.changePassword")}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1">••••••••</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </button>
                            </div>
                            
                            <div className="pt-2">
                                <button onClick={() => setShowDeleteModal(true)} className="w-full py-3 rounded-xl border border-destructive/20 text-destructive text-sm font-bold bg-destructive/5 hover:bg-destructive/10 transition-colors">
                                    Delete Account permanently
                                </button>
                            </div>

                            {user?.uid && <SecurityHistory userId={user.uid} />}
                        </div>
                    )}

                    {section === "settings" && (
                        <SettingsSection userId={user?.uid} initialSettings={(userProfile as any)?.settings} />
                    )}
                </div>
            </main>

            {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
            {showEmailModal && <ChangeEmailModal onClose={() => setShowEmailModal(false)} onSuccess={(m) => setToast({ message: m, type: "success" })} />}
            {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
        </div>
    );
}
