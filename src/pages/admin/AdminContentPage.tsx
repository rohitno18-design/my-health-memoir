import { useState, useEffect } from "react";
import { ArrowLeft, Megaphone, FileText, Languages, Plus, Trash2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Announcement {
    id: string;
    title: string;
    body: string;
    active: boolean;
    createdAt: string;
}

export function AdminContentPage() {
    const navigate = useNavigate();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newBody, setNewBody] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        try {
            const snap = await getDoc(doc(db, "app_config", "announcements"));
            if (snap.exists()) {
                const data = snap.data();
                setAnnouncements(data.items || []);
            }
        } catch (e) {
            console.error("Failed to load announcements:", e);
        } finally {
            setLoading(false);
        }
    };

    const saveAnnouncements = async (items: Announcement[]) => {
        try {
            await setDoc(doc(db, "app_config", "announcements"), { items });
            setAnnouncements(items);
        } catch (e) {
            console.error("Failed to save announcements:", e);
        }
    };

    const addAnnouncement = async () => {
        if (!newTitle.trim() || !newBody.trim()) return;
        setSaving(true);
        const item: Announcement = {
            id: Date.now().toString(),
            title: newTitle.trim(),
            body: newBody.trim(),
            active: true,
            createdAt: new Date().toISOString(),
        };
        const updated = [item, ...announcements];
        await saveAnnouncements(updated);
        setNewTitle("");
        setNewBody("");
        setShowNew(false);
        setSaving(false);
    };

    const toggleAnnouncement = async (id: string) => {
        const updated = announcements.map((a) =>
            a.id === id ? { ...a, active: !a.active } : a
        );
        await saveAnnouncements(updated);
    };

    const deleteAnnouncement = async (id: string) => {
        const updated = announcements.filter((a) => a.id !== id);
        await saveAnnouncements(updated);
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
                    <h1 className="text-xl font-bold tracking-tight">Content & Toggles</h1>
                </div>
            </div>

            {/* Global Announcements */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <Megaphone size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Global Announcements</h3>
                    <button
                        onClick={() => setShowNew(!showNew)}
                        className="ml-auto p-2 rounded-lg hover:bg-emerald-50 transition-colors text-emerald-600"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {showNew && (
                    <div className="mb-4 pl-11 space-y-3">
                        <input
                            type="text"
                            placeholder="Announcement title..."
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full text-sm bg-muted rounded-xl px-4 py-2.5 border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <textarea
                            placeholder="Announcement body..."
                            value={newBody}
                            onChange={(e) => setNewBody(e.target.value)}
                            rows={3}
                            className="w-full text-sm bg-muted rounded-xl px-4 py-2.5 border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                        />
                        <button
                            onClick={addAnnouncement}
                            disabled={saving || !newTitle.trim() || !newBody.trim()}
                            className="flex items-center gap-2 text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                        >
                            <Send size={14} /> {saving ? "Sending..." : "Send Announcement"}
                        </button>
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-muted-foreground pl-11">Loading...</p>
                ) : announcements.length === 0 ? (
                    <p className="text-sm text-muted-foreground pl-11">No announcements yet. Tap + to create one.</p>
                ) : (
                    <div className="pl-11 space-y-3">
                        {announcements.map((a) => (
                            <div
                                key={a.id}
                                className={`p-3 rounded-xl border transition-all ${a.active ? "border-emerald-200 bg-emerald-50/50" : "border-muted bg-muted/30 opacity-60"}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => toggleAnnouncement(a.id)}
                                            className="p-1.5 rounded-lg hover:bg-white transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            {a.active ? <Megaphone size={14} className="text-emerald-500" /> : <Megaphone size={14} />}
                                        </button>
                                        <button
                                            onClick={() => deleteAnnouncement(a.id)}
                                            className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors text-muted-foreground hover:text-rose-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Page Editor — Coming Soon */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm opacity-60">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                        <FileText size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Page Editor</h3>
                    <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                </div>
                <p className="text-sm text-muted-foreground pl-11">Edit Privacy Policy and Terms of Service.</p>
            </div>

            {/* Dictionary Tune — Coming Soon */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm opacity-60">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                        <Languages size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Dictionary Tune</h3>
                    <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                </div>
                <p className="text-sm text-muted-foreground pl-11">Update Hinglish translations over the air.</p>
            </div>
        </div>
    );
}
