import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
    ArrowRight, Brain, FileText, QrCode, Shield, Sparkles, Users,
    MessageCircleWarning, FolderX, Siren, UserPlus, UploadCloud,
    Stethoscope, Bell, Activity, Languages, Lock, EyeOff, Trash2,
    HeartPulse, ChevronDown, Phone, Droplets, Pill, CheckCircle2,
} from "lucide-react";

const fadeUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.45, ease: "easeOut" },
} as const;

export function LandingPage() {
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const anim = reduceMotion ? {} : fadeUp;

    return (
        <div className="min-h-screen bg-white overflow-hidden relative">
            {/* Background glow effects */}
            <div className="absolute inset-0 bg-glow-blue bg-glow-purple pointer-events-none" />
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-brand-indigo/5 blur-[180px] rounded-full pointer-events-none" />

            {/* ── Navigation ─────────────────────────────────────────────── */}
            <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/60">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="I M Smrti" className="size-10 rounded-2xl object-cover" />
                        <span className="text-xl font-black tracking-tight text-slate-900">
                            I M <span className="gradient-text">Smrti</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate("/login")} className="hidden md:flex text-sm font-bold text-slate-600 hover:text-brand-indigo transition-colors cursor-pointer">
                            Log In
                        </button>
                        <button onClick={() => navigate("/register")} className="btn-gradient px-6 py-2.5 rounded-xl text-sm font-bold active:scale-95 cursor-pointer">
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── Hero ───────────────────────────────────────────────────── */}
            <main className="relative pt-32 sm:pt-40 pb-14 sm:pb-20 px-6 z-10">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                    <div className="text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-indigo-100 shadow-sm mb-8 backdrop-blur-md">
                            <Sparkles size={14} className="text-brand-purple" />
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">For the one who takes care of everyone</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-[1.05] tracking-tighter mb-6">
                            Your Parents' Health,<br />
                            <span className="gradient-text">Finally Organized</span>
                        </h1>

                        <p className="text-base sm:text-lg text-slate-500 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                            Every prescription, lab report and medication for your whole family — safe in one app.
                            AI briefings before every doctor visit. A life-saving emergency card in every wallet.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-4">
                            <button onClick={() => navigate("/register")} className="btn-gradient px-9 py-4 rounded-2xl text-lg font-black flex items-center gap-3 cursor-pointer">
                                Get Started Free
                                <ArrowRight size={20} />
                            </button>
                            <button onClick={() => navigate("/login")} className="text-sm font-bold text-slate-500 hover:text-brand-indigo transition-colors px-4 py-4 cursor-pointer">
                                Already have an account? Log in →
                            </button>
                        </div>

                        <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4">
                            {[
                                ["1 App", "Whole Family"],
                                ["24/7", "Emergency Access"],
                                ["12", "Indian Languages"],
                            ].map(([big, small]) => (
                                <div key={small} className="text-center lg:text-left">
                                    <div className="text-xl sm:text-2xl font-black text-slate-900">{big}</div>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{small}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hero visual — emergency card mockup (code-based) */}
                    <motion.div
                        initial={reduceMotion ? false : { opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                        className="relative flex justify-center lg:justify-end"
                        aria-hidden="true"
                    >
                        <div className="relative w-full max-w-sm">
                            {/* Emergency card */}
                            <div className="relative z-10 bg-slate-900 rounded-3xl p-6 shadow-2xl shadow-indigo-500/20 border border-slate-700/50">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="size-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
                                            <HeartPulse size={18} className="text-rose-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-black text-sm">Emergency Pulse</p>
                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Scan in an emergency</p>
                                        </div>
                                    </div>
                                    {!reduceMotion && <span className="relative flex size-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full size-3 bg-rose-500"></span>
                                    </span>}
                                </div>
                                <div className="flex gap-4">
                                    <div className="bg-white rounded-2xl p-3 shrink-0">
                                        {/* Decorative QR */}
                                        <svg viewBox="0 0 84 84" className="size-24" role="img" aria-label="QR code illustration">
                                            <rect width="84" height="84" fill="white" />
                                            <g fill="#0f172a">
                                                <rect x="4" y="4" width="24" height="24" rx="3" /><rect x="10" y="10" width="12" height="12" fill="white" rx="2" />
                                                <rect x="56" y="4" width="24" height="24" rx="3" /><rect x="62" y="10" width="12" height="12" fill="white" rx="2" />
                                                <rect x="4" y="56" width="24" height="24" rx="3" /><rect x="10" y="62" width="12" height="12" fill="white" rx="2" />
                                                <rect x="36" y="8" width="6" height="6" /><rect x="44" y="16" width="6" height="6" /><rect x="36" y="24" width="6" height="6" />
                                                <rect x="8" y="36" width="6" height="6" /><rect x="20" y="40" width="6" height="6" /><rect x="32" y="36" width="8" height="8" />
                                                <rect x="46" y="38" width="6" height="6" /><rect x="58" y="36" width="6" height="6" /><rect x="70" y="40" width="6" height="6" />
                                                <rect x="38" y="52" width="6" height="6" /><rect x="48" y="58" width="8" height="8" /><rect x="62" y="54" width="6" height="6" />
                                                <rect x="36" y="70" width="6" height="6" /><rect x="56" y="70" width="8" height="6" /><rect x="70" y="64" width="6" height="10" />
                                            </g>
                                        </svg>
                                    </div>
                                    <div className="space-y-2 min-w-0 py-1">
                                        <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold"><Droplets size={13} className="text-rose-400 shrink-0" /> Blood: B+</div>
                                        <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold"><Pill size={13} className="text-blue-400 shrink-0" /> Metformin 500mg</div>
                                        <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold"><MessageCircleWarning size={13} className="text-amber-400 shrink-0" /> Allergy: Penicillin</div>
                                        <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold"><Phone size={13} className="text-emerald-400 shrink-0" /> Call: Rohan (Son)</div>
                                    </div>
                                </div>
                            </div>
                            {/* Floating chips */}
                            {!reduceMotion && (
                                <>
                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute -top-6 -left-4 z-20 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-2.5 flex items-center gap-2"
                                    >
                                        <CheckCircle2 size={15} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-slate-700">Report uploaded for Papa</span>
                                    </motion.div>
                                    <motion.div
                                        animate={{ y: [0, 8, 0] }}
                                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                        className="absolute -bottom-6 -right-2 z-20 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-2.5 flex items-center gap-2"
                                    >
                                        <Stethoscope size={15} className="text-blue-600" />
                                        <span className="text-xs font-bold text-slate-700">Briefing ready for Dr. Verma</span>
                                    </motion.div>
                                </>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 blur-3xl -z-10 scale-110" />
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* ── Problem section ────────────────────────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6 bg-slate-900">
                <div className="max-w-6xl mx-auto">
                    <motion.div {...anim} className="text-center mb-12">
                        <p className="text-xs font-black text-rose-400 uppercase tracking-[0.2em] mb-3">The problem every family knows</p>
                        <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 leading-tight">
                            15 years of your father's health<br className="hidden sm:block" /> lives in a plastic bag
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                            Prescriptions in a polythene bag. Lab reports as WhatsApp forwards. And when a new doctor asks
                            <em className="text-slate-300"> "what medications is he on?"</em> — everyone looks at each other.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-5">
                        {[
                            {
                                icon: FolderX, color: "text-rose-400 bg-rose-400/10",
                                title: "Reports scattered everywhere",
                                desc: "Files at home, scans in WhatsApp, prescriptions lost between hospital visits. Nothing is findable when it matters.",
                            },
                            {
                                icon: MessageCircleWarning, color: "text-amber-400 bg-amber-400/10",
                                title: "Managing it from another city",
                                desc: "You're in Bangalore, your parents are in Bhopal. Every appointment becomes a chain of calls, photos, and guesswork.",
                            },
                            {
                                icon: Siren, color: "text-blue-400 bg-blue-400/10",
                                title: "Emergencies find you unprepared",
                                desc: "In a crisis, nobody remembers the blood group, allergies, or the blood thinner. The information exists — just not where it's needed.",
                            },
                        ].map(({ icon: Icon, color, title, desc }) => (
                            <motion.div key={title} {...anim} className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-7">
                                <div className={`size-12 rounded-2xl flex items-center justify-center mb-5 ${color}`}>
                                    <Icon size={24} />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ───────────────────────────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div {...anim} className="text-center mb-14">
                        <p className="text-xs font-black text-brand-indigo uppercase tracking-[0.2em] mb-3">How it works</p>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
                            Organized in <span className="gradient-text">three steps</span>
                        </h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                step: "1", icon: UserPlus,
                                title: "Add your family",
                                desc: "Create a profile for each person you care for — parents, spouse, children. Blood group, conditions, medications, allergies.",
                            },
                            {
                                step: "2", icon: UploadCloud,
                                title: "Upload as you go",
                                desc: "Snap a photo of any prescription or report. Everything is organized by person, date and doctor — searchable forever.",
                            },
                            {
                                step: "3", icon: Shield,
                                title: "Be ready for anything",
                                desc: "Walk into appointments with an AI briefing. Put the emergency card in their wallet. Sleep better.",
                            },
                        ].map(({ step, icon: Icon, title, desc }) => (
                            <motion.div key={step} {...anim} className="relative card-premium p-8">
                                <div className="absolute -top-4 left-8 size-8 rounded-full btn-gradient flex items-center justify-center text-white text-sm font-black">{step}</div>
                                <div className="size-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-5 mt-2">
                                    <Icon size={24} className="text-brand-indigo" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Feature deep-dive: Family vault ────────────────────────── */}
            <section className="section-soft relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
                    <motion.div {...anim}>
                        <p className="text-xs font-black text-brand-indigo uppercase tracking-[0.2em] mb-3">One vault, whole family</p>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-5 leading-tight">
                            Papa's cardiology. Mummy's diabetes.<br />Your child's vaccinations.
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-6">
                            One account manages everyone. Each family member gets their own complete health profile —
                            documents, vitals history, medications, insurance details and emergency contacts — organized
                            automatically and accessible in seconds.
                        </p>
                        <ul className="space-y-3">
                            {[
                                "Unlimited documents per person — prescriptions, reports, scans",
                                "Vitals tracking with trends: sugar, BP, weight and more",
                                "Medicine and appointment reminders for the whole family",
                                "Works in 12 Indian languages — including for your parents",
                            ].map(item => (
                                <li key={item} className="flex items-start gap-3 text-sm text-slate-600 font-medium">
                                    <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                    <motion.div {...anim} className="relative" aria-hidden="true">
                        <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-indigo-500/10 border border-slate-100">
                            <img src="/assets/images/bg-family.png" alt="" className="w-full h-72 sm:h-96 object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                            <div className="absolute bottom-5 left-5 right-5 flex gap-3">
                                {[
                                    { name: "Papa", rel: "Father", color: "bg-blue-500" },
                                    { name: "Mummy", rel: "Mother", color: "bg-rose-500" },
                                    { name: "Aarav", rel: "Son", color: "bg-emerald-500" },
                                ].map(p => (
                                    <div key={p.name} className="flex-1 bg-white/95 backdrop-blur rounded-2xl p-3 min-w-0">
                                        <div className={`size-8 rounded-full ${p.color} flex items-center justify-center text-white text-xs font-black mb-1.5`}>{p.name[0]}</div>
                                        <p className="text-xs font-black text-slate-900 truncate">{p.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold">{p.rel}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature deep-dive: Visit briefings ─────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
                    {/* Code-based briefing mockup */}
                    <motion.div {...anim} className="relative order-2 lg:order-1" aria-hidden="true">
                        <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-500/10 border border-slate-100 p-7 max-w-md mx-auto">
                            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                                <div className="size-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Stethoscope size={20} className="text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm">Visit Briefing — Papa</p>
                                    <p className="text-[11px] text-slate-400 font-bold">Cardiology follow-up · Dr. Verma</p>
                                </div>
                            </div>
                            {[
                                ["Current Medications", "Metformin 500mg · Telmisartan 40mg", "text-blue-600"],
                                ["Recent Findings", "HbA1c improved 8.1 → 7.2 over 3 months", "text-emerald-600"],
                                ["Watch Out", "BP readings trending high in last 2 weeks", "text-amber-600"],
                                ["Ask the Doctor", "Should the evening dose change given the new BP trend?", "text-indigo-600"],
                            ].map(([label, text, color]) => (
                                <div key={label} className="py-3 border-b border-slate-50 last:border-0">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${color}`}>{label}</p>
                                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{text}</p>
                                </div>
                            ))}
                            <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                <Sparkles size={12} className="text-brand-purple" />
                                Generated from Papa's records in 20 seconds
                            </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-indigo-400/10 blur-3xl -z-10" />
                    </motion.div>

                    <motion.div {...anim} className="order-1 lg:order-2">
                        <p className="text-xs font-black text-brand-purple uppercase tracking-[0.2em] mb-3">AI doctor visit briefings</p>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-5 leading-tight">
                            Walk into every appointment<br />with everything that matters
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-6">
                            Ten minutes with the doctor. Six months of reports. Our AI reads your family member's complete
                            history and prepares a one-page briefing — medications, recent findings, vitals trends, and the
                            questions worth asking. Download it as a PDF and carry it in.
                        </p>
                        <ul className="space-y-3">
                            {[
                                "Built only from your own uploaded records — nothing invented",
                                "Available in English or your own language",
                                "Flags abnormal trends a busy doctor should notice",
                            ].map(item => (
                                <li key={item} className="flex items-start gap-3 text-sm text-slate-600 font-medium">
                                    <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>
            </section>

            {/* ── Feature deep-dive: Emergency ───────────────────────────── */}
            <section className="section-soft relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div {...anim} className="text-center mb-12">
                        <p className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] mb-3">Emergency Pulse</p>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-4 leading-tight">
                            The 30 seconds that matter most
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                            A QR code on your parent's phone, wallet or scooter helmet. Any stranger can scan it —
                            no app, no login — and instantly see blood group, medications, allergies and whom to call.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-4 gap-4">
                        {[
                            { icon: Droplets, label: "Blood group", desc: "Visible instantly to first responders" },
                            { icon: Pill, label: "Medications", desc: "Critical drugs like blood thinners flagged" },
                            { icon: MessageCircleWarning, label: "Allergies", desc: "Prevents dangerous treatment mistakes" },
                            { icon: Phone, label: "Emergency contacts", desc: "You get the call in seconds, not hours" },
                        ].map(({ icon: Icon, label, desc }) => (
                            <motion.div key={label} {...anim} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center">
                                <div className="size-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
                                    <Icon size={22} className="text-rose-500" />
                                </div>
                                <h3 className="font-black text-slate-900 text-sm mb-1.5">{label}</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Everything else grid ───────────────────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div {...anim} className="text-center mb-12">
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
                            And everything <span className="gradient-text">around it</span>
                        </h2>
                    </motion.div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            { icon: Bell, title: "Smart Reminders", desc: "Medicines, follow-ups and tests — for every family member, so nothing gets missed." },
                            { icon: Activity, title: "Vitals Tracking", desc: "Log sugar, BP and weight in seconds. See trends the way a doctor would." },
                            { icon: Brain, title: "AI Document Analysis", desc: "Upload any report and get a plain-language summary you actually understand." },
                            { icon: FileText, title: "Secure Sharing", desc: "Share a report with a doctor via PIN-protected link that expires automatically." },
                            { icon: Languages, title: "12 Indian Languages", desc: "Hindi, Tamil, Telugu, Bengali and more — so your parents can use it themselves." },
                            { icon: Users, title: "Health Timeline", desc: "Every event — surgeries, diagnoses, reports — on one timeline per person." },
                        ].map(({ icon: Icon, title, desc }) => (
                            <motion.div key={title} {...anim} className="card-premium p-7 group">
                                <div className="size-11 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Icon size={22} className="text-brand-indigo" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Trust & security ───────────────────────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6 bg-slate-900">
                <div className="max-w-6xl mx-auto">
                    <motion.div {...anim} className="text-center mb-12">
                        <p className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">Your family's data is sacred</p>
                        <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
                            Private by design. By law. By promise.
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
                            Health data is the most personal thing you own. We treat it that way.
                        </p>
                    </motion.div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { icon: Lock, title: "Encrypted & secured", desc: "Bank-grade encryption in transit and at rest, with biometric app lock on your phone." },
                            { icon: EyeOff, title: "Never sold. Ever.", desc: "No ads, no data brokers, no third parties. Your records exist for your family only." },
                            { icon: Shield, title: "DPDP Act 2023 compliant", desc: "Full compliance with India's data protection law — including your right to erasure." },
                            { icon: Trash2, title: "Delete anytime", desc: "One tap deletes your account and every record, permanently. No dark patterns." },
                        ].map(({ icon: Icon, title, desc }) => (
                            <motion.div key={title} {...anim} className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6">
                                <div className="size-11 rounded-2xl bg-emerald-400/10 flex items-center justify-center mb-4">
                                    <Icon size={21} className="text-emerald-400" />
                                </div>
                                <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
                                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Who it's for ───────────────────────────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <motion.div {...anim} className="text-center mb-12">
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-4">
                            Built for people <span className="gradient-text">like you</span>
                        </h2>
                    </motion.div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                title: "The son in another city",
                                desc: "Your parents are aging in your hometown while you work far away. Track every appointment, see every report the moment it's uploaded, and stop managing their health over blurry WhatsApp photos.",
                            },
                            {
                                title: "The family CHO — Chief Health Officer",
                                desc: "Every family has one: the person who remembers everyone's medicines, books every appointment, keeps every file. This is your command center.",
                            },
                            {
                                title: "The caregiver of a chronic patient",
                                desc: "Diabetes, cardiac care, kidney disease — chronic illness means dozens of reports across doctors and labs. Keep the full story in one place, ready for every consultation.",
                            },
                        ].map(({ title, desc }) => (
                            <motion.div key={title} {...anim} className="relative bg-gradient-to-b from-indigo-50/70 to-white rounded-3xl border border-indigo-100/70 p-8">
                                <HeartPulse size={22} className="text-brand-indigo mb-4" />
                                <h3 className="font-black text-slate-900 text-lg mb-3 leading-snug">{title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ────────────────────────────────────────────────────── */}
            <section className="section-soft relative z-10 py-16 sm:py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <motion.div {...anim} className="text-center mb-10">
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900">Questions, answered</h2>
                    </motion.div>
                    <div className="space-y-3">
                        {[
                            ["Is it really free?", "Yes. Storing records, family profiles, reminders, vitals and the emergency card are free. Advanced AI features like doctor visit briefings are part of Premium, which is rolling out soon."],
                            ["Is my family's health data safe?", "Yes. Data is encrypted in transit and at rest, protected by biometric app lock, and we comply fully with India's DPDP Act 2023. We never sell or share your data with anyone — our business model is subscriptions, not your data."],
                            ["Can my parents use it in Hindi or their own language?", "Yes — the app works in 12 Indian languages including Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi and Urdu."],
                            ["What happens in an emergency if my phone is locked?", "The Emergency Pulse QR works from a lock screen wallpaper, a printed card in a wallet, or a sticker. Anyone can scan it with any phone camera — no app needed — and see only the medical info you chose to share."],
                            ["Can I add my parents' old reports?", "Yes. Photograph or upload any old prescription, report or scan. Everything is organized by person and date, so 15 years of history becomes searchable in an afternoon."],
                            ["Can I delete everything if I change my mind?", "Absolutely. Account deletion is one tap in settings and permanently erases every record. You can also export all your data as a file anytime."],
                        ].map(([q, a]) => (
                            <motion.details key={q} {...anim} className="group bg-white rounded-2xl border border-slate-100 shadow-sm open:shadow-md transition-shadow">
                                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none text-sm font-bold text-slate-800 select-none">
                                    {q}
                                    <ChevronDown size={18} className="text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <p className="px-5 pb-5 text-sm text-slate-500 leading-relaxed">{a}</p>
                            </motion.details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ──────────────────────────────────────────────── */}
            <section className="relative z-10 py-16 sm:py-24 px-6">
                <motion.div {...anim} className="max-w-4xl mx-auto text-center bg-slate-900 rounded-[2.5rem] px-8 py-14 sm:py-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
                    <div className="relative">
                        <QrCode size={36} className="text-indigo-400 mx-auto mb-6" />
                        <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 leading-tight">
                            Start with one report.<br />Your family will thank you in an emergency.
                        </h2>
                        <p className="text-slate-400 text-sm sm:text-base mb-8 max-w-xl mx-auto">
                            Free to start. Takes two minutes. Works in your language.
                        </p>
                        <button onClick={() => navigate("/register")} className="btn-gradient px-10 py-4 rounded-2xl text-lg font-black inline-flex items-center gap-3 cursor-pointer">
                            Create Your Family Vault
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </motion.div>
            </section>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <footer className="relative z-10 border-t border-slate-100 bg-white">
                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
                        <div className="max-w-xs">
                            <div className="flex items-center gap-3 mb-3">
                                <img src="/logo.png" alt="I M Smrti" className="size-9 rounded-xl object-cover" />
                                <span className="text-lg font-black tracking-tight text-slate-900">I M <span className="gradient-text">Smrti</span></span>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                The health record app for the one who takes care of everyone. Made in India, for Indian families.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-x-10 gap-y-4">
                            <div className="space-y-2.5">
                                <p className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Product</p>
                                <button onClick={() => navigate("/register")} className="block text-sm font-medium text-slate-500 hover:text-brand-indigo transition-colors cursor-pointer">Get Started</button>
                                <button onClick={() => navigate("/login")} className="block text-sm font-medium text-slate-500 hover:text-brand-indigo transition-colors cursor-pointer">Log In</button>
                            </div>
                            <div className="space-y-2.5">
                                <p className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">Legal</p>
                                <button onClick={() => navigate("/privacy")} className="block text-sm font-medium text-slate-500 hover:text-brand-indigo transition-colors cursor-pointer">Privacy Policy</button>
                                <button onClick={() => navigate("/terms")} className="block text-sm font-medium text-slate-500 hover:text-brand-indigo transition-colors cursor-pointer">Terms of Service</button>
                                <button onClick={() => navigate("/delete-account")} className="block text-sm font-medium text-slate-500 hover:text-brand-indigo transition-colors cursor-pointer">Data Deletion</button>
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Shield size={15} />
                            <span className="text-xs font-medium">Encrypted &amp; secured · DPDP Act 2023 compliant · Your data is never sold</span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">© {new Date().getFullYear()} I M Smrti</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
