import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ShieldAlert, Phone, Droplets, AlertCircle, 
  Loader2, Info, User, Pill
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getFunctions, httpsCallable } from "firebase/functions";
const pulseFunctions = getFunctions();
const getEmergency = httpsCallable(pulseFunctions, 'getEmergencyInfo');

interface EmergencyInfo {
  patientName?: string;
  photoURL?: string;
  dob?: string;
  gender?: string;
  bloodType: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  iceContacts: Array<{ name: string; phone: string; relation: string }>;
  organDonor: boolean;
  userId?: string;
}

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function PulsePage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const pulseToken = searchParams.get("token") || undefined;
  const [info, setInfo] = useState<EmergencyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchInfo = async () => {
      try {
        const result = await getEmergency({ userId, pulseToken });
        setInfo(result.data as EmergencyInfo);
      } catch (e) {
        console.error("Pulse fetch error:", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-4">
      <Loader2 className="animate-spin text-rose-600" size={40} />
      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{t("pulse.accessing")}</p>
    </div>
  );

  if (error || !info) return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <AlertCircle className="text-rose-500" size={48} />
      <h1 className="text-2xl font-black text-slate-900">{t("pulse.notFound")}</h1>
      <p className="text-slate-600 font-medium leading-relaxed">
        {t("pulse.privateDesc")}
      </p>
    </div>
  );

  const age = info.dob ? calcAge(info.dob) : null;

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-inter pb-16">

      {/* High Contrast Emergency Header */}
      <header className="bg-[#D32F2F] px-6 pt-12 pb-32 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
            <ShieldAlert size={120} />
        </div>
        
        <div className="flex items-center justify-between relative z-10 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldAlert size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{t("pulse.liveId")}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
             <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
             <span className="text-[9px] font-black uppercase tracking-widest">{t("pulse.activeLabel")}</span>
          </div>
        </div>

        <div className="text-center relative z-10">
            <h1 className="text-3xl font-black font-lexend tracking-tighter uppercase mb-1">{t("pulse.hub")}</h1>
            <p className="text-[11px] font-bold text-white/60 uppercase tracking-[0.3em]">{t("pulse.tagline")}</p>
        </div>

        {/* Floating Profile Photo — MASSIVE & CENTERED */}
        <div className="absolute left-1/2 -bottom-24 -translate-x-1/2 flex flex-col items-center w-full px-6 z-20">
           <div className="size-48 rounded-[3rem] overflow-hidden bg-white shadow-[0_20px_50px_rgba(211,47,47,0.3)] border-[6px] border-white flex items-center justify-center relative transition-transform hover:scale-105 duration-500">
              {info.photoURL ? (
                <img src={info.photoURL} alt={info.patientName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                  <User size={100} className="text-slate-200" />
                </div>
              )}
           </div>
        </div>
      </header>

      <main className="px-6 pt-28 space-y-8 max-w-xl mx-auto">
        
        {/* Name & Basic Identity — MASSIVE */}
        <section className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-4xl font-black font-lexend tracking-tighter text-slate-950 uppercase leading-[0.9]">
            {info.patientName || t("patients.profile")}
          </h2>
          
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            {info.bloodType && (
              <div className="bg-[#D32F2F] text-white px-6 py-3 rounded-2xl flex items-center gap-2.5 shadow-lg shadow-rose-200 active:scale-95 transition-all">
                <Droplets size={20} fill="currentColor" className="animate-pulse" />
                <span className="text-2xl font-black tracking-tighter">{info.bloodType}</span>
              </div>
            )}
            
            <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                    {info.gender && (
                        <span className="bg-slate-900 text-white text-[13px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-sm">
                            {t(`common.${info.gender.toLowerCase()}`)}
                        </span>
                    )}
                    {age !== null && (
                        <span className="bg-white border-2 border-slate-100 text-slate-800 text-[13px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl shadow-sm">
                            {age} {t("common.yrs")}
                        </span>
                    )}
                </div>
            </div>
          </div>
        </section>

        {/* Quick Vitals / Blood Type Highlight */}
        <section className="grid grid-cols-2 gap-4">
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">{t("emergency.bloodGroup")}</span>
              <span className="text-4xl font-black text-slate-900">{info.bloodType || "—"}</span>
           </div>
           <div className={cn(
             "p-6 rounded-[2rem] shadow-sm flex flex-col items-center text-center border transition-colors",
             info.organDonor ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-white border-slate-100 text-slate-400"
           )}>
              <span className="text-[10px] font-black uppercase tracking-widest mb-2">{t("emergency.organDonor")}</span>
              <span className="text-xl font-black">{info.organDonor ? t("emergency.yes") : t("emergency.no")}</span>
           </div>
        </section>

        {/* Critical Alerts */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">{t("pulse.criticalAlerts")}</h3>

          {info.allergies && info.allergies.length > 0 && (
            <div className="bg-amber-50 p-6 rounded-[2.5rem] border-2 border-amber-200/50">
              <div className="flex items-center gap-2 text-amber-900 mb-4">
                <AlertCircle size={20} className="text-amber-600" />
                <span className="font-black text-sm uppercase tracking-wide">{t("pulse.knownAllergies")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {info.allergies.map(a => (
                  <span key={a} className="px-5 py-2.5 bg-white rounded-2xl border border-amber-200 font-black text-amber-800 text-base shadow-sm">⚠ {a}</span>
                ))}
              </div>
            </div>
          )}

          {info.conditions && info.conditions.length > 0 && (
            <div className="bg-slate-950 p-6 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/20">
              <div className="flex items-center gap-2 text-slate-500 mb-4">
                <Info size={20} />
                <span className="font-black text-sm uppercase tracking-wide text-slate-400">{t("pulse.medicalConditions")}</span>
              </div>
              <div className="space-y-2">
                {info.conditions.map(c => (
                  <p key={c} className="font-bold text-xl leading-tight border-l-4 border-rose-600 pl-4 py-1">{c}</p>
                ))}
              </div>
            </div>
          )}

          {info.medications && info.medications.length > 0 && (
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200">
              <div className="flex items-center gap-2 text-violet-700 mb-4">
                <Pill size={20} />
                <span className="font-black text-sm uppercase tracking-wide">{t("pulse.currentMeds")}</span>
              </div>
              <div className="space-y-2">
                {info.medications.map(m => (
                  <div key={m} className="p-3 bg-slate-50 rounded-xl font-bold text-slate-700 text-base border border-slate-100 italic">
                    "{m}"
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ICE Contacts — Massive Mobile Dialers */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">📞 {t("pulse.iceTitle")}</h3>
          <div className="space-y-4">
            {info.iceContacts && info.iceContacts.filter(c => c.name).map((contact, i) => (
              <a
                key={i}
                href={contact.phone ? `tel:${contact.phone}` : undefined}
                className={cn(
                  "w-full flex items-center justify-between p-6 rounded-[2.5rem] transition-all",
                  contact.phone 
                    ? "bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 active:scale-[0.98] active:bg-emerald-700" 
                    : "bg-white text-slate-400 border border-slate-200"
                )}
              >
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "size-16 rounded-[1.25rem] flex items-center justify-center font-black text-2xl shadow-inner",
                    contact.phone ? "bg-white/20" : "bg-slate-100 text-slate-300"
                  )}>
                    {contact.name[0]?.toUpperCase()}
                  </div>
                  <div className="text-left">
                    <h4 className="text-2xl font-black font-lexend leading-tight tracking-tight">{contact.name}</h4>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1", contact.phone ? "text-emerald-100" : "text-slate-400")}>{contact.relation}</p>
                    {contact.phone && <p className="text-base font-bold mt-1 text-emerald-50 opacity-90">{contact.phone}</p>}
                  </div>
                </div>
                {contact.phone && <Phone size={32} className="opacity-80" />}
              </a>
            ))}
          </div>
        </section>

        <footer className="text-center pt-8 pb-12 opacity-30">
          <ShieldAlert className="mx-auto mb-2" size={24} />
          <p className="text-[10px] font-black uppercase tracking-[0.4em]">{t("pulse.tagline")}</p>
          <p className="text-[8px] font-bold mt-1 uppercase">{t("pulse.footerSub")}</p>
        </footer>
      </main>
    </div>
  );
}
