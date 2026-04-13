import { ArrowLeft, Megaphone, FileText, Languages } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AdminContentPage() {
    const navigate = useNavigate();

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

            <div className="grid gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm opacity-60">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                            <Megaphone size={16} />
                        </div>
                        <h3 className="font-semibold text-foreground">Global Announcements</h3>
                        <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-11">Push alerts to all users instantly.</p>
                </div>

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
        </div>
    );
}
