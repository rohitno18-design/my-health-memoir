import { ArrowLeft, ToggleLeft, Sparkles, ServerCrash } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AdminSettingsPage() {
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
                    <h1 className="text-xl font-bold tracking-tight">System & AI</h1>
                </div>
            </div>

            <div className="grid gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm opacity-60">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
                            <ToggleLeft size={16} />
                        </div>
                        <h3 className="font-semibold text-foreground">Feature Flags</h3>
                         <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-11">Turn major app features on or off remotely.</p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm opacity-60">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                            <Sparkles size={16} />
                        </div>
                        <h3 className="font-semibold text-foreground">AI Prompt Tuner</h3>
                         <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-11">Tweak Gemini's system instructions live.</p>
                </div>
                
                 <div className="bg-card border border-border rounded-2xl p-5 shadow-sm opacity-60">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
                            <ServerCrash size={16} />
                        </div>
                        <h3 className="font-semibold text-foreground">Audit Logs</h3>
                         <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-11">View an immutable ledger of admin actions.</p>
                </div>
            </div>
        </div>
    );
}
