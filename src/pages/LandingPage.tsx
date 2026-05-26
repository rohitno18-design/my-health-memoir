import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, FileText, QrCode, Shield, Sparkles } from "lucide-react";

export function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white overflow-hidden relative">
            {/* Background glow effects */}
            <div className="absolute inset-0 bg-glow-blue bg-glow-purple pointer-events-none" />
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-brand-indigo/5 blur-[180px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-brand-purple/5 blur-[180px] rounded-full pointer-events-none" />

            {/* Navigation */}
            <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/60">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="I M Smrti" className="size-10 rounded-2xl object-cover" />
                        <span className="text-xl font-black tracking-tight text-slate-900">
                            I M <span className="gradient-text">Smrti</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/login")} className="hidden md:flex text-sm font-bold text-slate-600 hover:text-brand-indigo transition-colors">
                            Log In
                        </button>
                        <button onClick={() => navigate("/register")} className="btn-gradient px-6 py-2.5 rounded-xl text-sm font-bold active:scale-95">
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative pt-36 sm:pt-44 pb-16 sm:pb-24 px-6 z-10 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-indigo-100 shadow-sm mb-8 backdrop-blur-md animate-fade-in">
                    <Sparkles size={14} className="text-brand-purple" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">AI-Powered Health OS</span>
                </div>

                <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-slate-900 leading-tight tracking-tighter mb-6 max-w-4xl animate-slide-up">
                    Your Entire Medical<br className="hidden md:block"/> 
                    History, <span className="gradient-text">Powered by AI</span>
                </h1>
                
                <p className="text-base sm:text-lg text-slate-500 mb-10 max-w-2xl leading-relaxed animate-fade-in">
                    I M Smrti centralizes your health records, analyzes documents with AI, and provides life-saving emergency access to paramedics — all in one place.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 animate-slide-up">
                    <button onClick={() => navigate("/register")} className="btn-gradient px-10 py-4 rounded-2xl text-lg font-black flex items-center gap-3">
                        Get Started Free
                        <ArrowRight size={20} />
                    </button>
                    <button onClick={() => navigate("/login")} className="text-sm font-bold text-slate-500 hover:text-brand-indigo transition-colors px-4">
                        Already have an account? Log in →
                    </button>
                </div>

                {/* Stats bar */}
                <div className="mt-16 sm:mt-20 flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-center animate-fade-in">
                    <div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900">24/7</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Emergency Access</div>
                    </div>
                    <div className="w-px h-10 bg-slate-200 hidden sm:block" />
                    <div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900">8+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Languages</div>
                    </div>
                    <div className="w-px h-10 bg-slate-200 hidden sm:block" />
                    <div>
                        <div className="text-2xl sm:text-3xl font-black gradient-text">AI</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Powered Analysis</div>
                    </div>
                </div>
            </main>

            {/* Features Section */}
            <section className="section-soft relative z-10 py-20 sm:py-28 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-4">
                            Everything you need, <span className="gradient-text">in one place</span>
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto">
                            From AI document analysis to emergency QR codes — built for Indian families.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="card-premium p-8 group">
                            <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Brain size={24} className="text-brand-indigo" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-3">AI Intelligence</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                Instantly summarize doctor reports in plain language. Track vitals trends and get smart health insights.
                            </p>
                        </div>

                        <div className="card-premium p-8 group glow-purple">
                            <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <FileText size={24} className="text-brand-purple" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Universal Records</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                Store prescriptions, lab reports, and scans securely. Access them anywhere, anytime.
                            </p>
                        </div>

                        <div className="card-premium p-8 group">
                            <div className="size-12 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <QrCode size={24} className="text-brand-accent" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Emergency Pulse</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                QR code on your lock screen. Paramedics scan it to see your allergies, medications, and emergency contacts.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-slate-100 bg-white">
                <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Shield size={16} />
                        <span className="text-sm font-medium">End-to-end encrypted. HIPAA & GDPR compliant.</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <button onClick={() => navigate("/privacy")} className="text-sm font-bold text-slate-500 hover:text-brand-indigo transition-colors">Privacy</button>
                        <button onClick={() => navigate("/terms")} className="text-sm font-bold text-slate-500 hover:text-brand-indigo transition-colors">Terms</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
