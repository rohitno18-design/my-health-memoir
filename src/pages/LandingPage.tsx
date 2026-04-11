import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Activity, Brain, Server, ShieldAlert } from "lucide-react";

export function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-health-teal/20 blur-[120px] rounded-full mix-blend-multiply pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-health-emerald/20 blur-[120px] rounded-full mix-blend-multiply pointer-events-none" />

            {/* Navigation */}
            <nav className="fixed top-0 inset-x-0 z-50 glass-morphism border-b border-white/20">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-gradient-to-tr from-primary to-health-teal flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <Activity size={20} strokeWidth={3} />
                        </div>
                        <span className="text-xl font-black tracking-tight text-slate-800">
                            I M <span className="text-primary">Smrti</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate("/login")}
                            className="hidden md:flex text-sm font-bold text-slate-600 hover:text-primary transition-colors"
                        >
                            Log In
                        </button>
                        <button 
                            onClick={() => navigate("/register")}
                            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-md active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative pt-40 pb-20 px-6 z-10 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-white/80 shadow-sm mb-8 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-700">
                    <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Universal Health OS 1.0</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-tight tracking-tighter mb-6 max-w-4xl animate-in slide-in-from-bottom-8 duration-700 delay-100">
                    A Brain for Your <br className="hidden md:block"/> 
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-health-teal to-health-blue">
                        Entire Medical History
                    </span>
                </h1>
                
                <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl leading-relaxed animate-in slide-in-from-bottom-10 duration-700 delay-200">
                    I M Smrti centralizes your health records securely, analyzing documents with AI, and providing life-saving access to paramedics via Emergency SOS mode.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-in slide-in-from-bottom-12 duration-700 delay-300">
                    <button 
                        onClick={() => navigate("/register")}
                        className="w-full sm:w-auto bg-primary text-white px-10 py-4 rounded-2xl text-lg font-black hover:bg-primary/90 hover:scale-105 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
                    >
                        Create Free Account
                        <ArrowRight size={20} />
                    </button>
                </div>
            </main>

            {/* Features Grid */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-20 pt-10">
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bento-card group">
                        <div className="size-14 rounded-2xl bg-blue-50 text-health-blue flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Brain size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">AI Intelligence</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Powered by medical AI. Instantly summarize long Doctor's notes and extract vital trends like Blood Pressure automatically.
                        </p>
                    </div>

                    <div className="bento-card group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                        <div className="size-14 rounded-2xl bg-emerald-50 text-health-emerald flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Server size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Universal Records</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Never lose a prescription again. Store thousands of PDFs and medical images securely on the cloud.
                        </p>
                    </div>

                    <div className="bento-card group">
                        <div className="size-14 rounded-2xl bg-rose-50 text-health-rose flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <ShieldAlert size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">Emergency Pulse</h3>
                        <p className="text-slate-500 leading-relaxed text-sm">
                            Generate a custom QR Code for your phone lockscreen. Paramedics can scan it to instantly view your allergies and emergency contacts.
                        </p>
                    </div>
                </div>
            </section>

            {/* Trust Footer */}
            <footer className="relative z-10 border-t border-slate-200 bg-white/50 backdrop-blur-sm mt-10">
                <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Shield size={16} />
                        <span className="text-sm font-medium">Secured by strict Row-Level Security via Firebase</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-6 justify-center">
                        <button onClick={() => navigate("/privacy")} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Privacy Policy</button>
                        <button onClick={() => navigate("/terms")} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Terms of Service</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
