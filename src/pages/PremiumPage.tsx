import { useTranslation } from "react-i18next";
import { Star, Shield, Bot, FolderSync, ActivitySquare, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PremiumPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const features = [
        {
            icon: <Bot className="text-blue-500" size={24} />,
            title: "AI Medical Chat",
            desc: "Chat securely with an advanced AI that understands your entire medical history."
        },
        {
            icon: <FolderSync className="text-purple-500" size={24} />,
            title: "Smart AI Folders",
            desc: "Automatically organize massive stacks of medical records into neat categories."
        },
        {
            icon: <ActivitySquare className="text-emerald-500" size={24} />,
            title: "Automated Life Timeline",
            desc: "AI reads your documents and plots key health events directly on your timeline."
        },
        {
            icon: <Shield className="text-amber-500" size={24} />,
            title: "Priority Secure Sharing",
            desc: "Share advanced AI summaries with doctors via PIN-protected links."
        }
    ];

    return (
        <div className="pb-32 w-full max-w-lg mx-auto overflow-x-hidden space-y-6 px-5 pt-5 relative">
            <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-amber-200/40 via-amber-100/10 to-transparent -z-10 pointer-events-none rounded-b-[4rem]"></div>
            
            <div className="pt-6 pb-2 text-center">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4 border border-amber-300">
                    <Star size={32} className="text-white fill-white" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Unlock Premium</h1>
                <p className="text-sm font-medium text-slate-500 mt-2 max-w-[260px] mx-auto">
                    Take full control of your health data with advanced AI automation.
                </p>
            </div>

            <div className="space-y-3">
                {features.map((f, i) => (
                    <div key={i} className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-[1rem] bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                            {f.icon}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{f.title}</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <h3 className="font-bold text-lg mb-1">Upgrade Today</h3>
                    <p className="text-sm text-slate-300 font-medium mb-6">Coming soon! We are currently rolling out Premium in beta.</p>
                    
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-3.5 bg-white text-slate-900 font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={18} />
                        Return to Home
                    </button>
                </div>
            </div>
        </div>
    );
}
