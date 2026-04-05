import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { 
  ShieldAlert, Phone, Droplets, AlertCircle, 
  Heart, Loader2, Info, Activity, User
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface EmergencyInfo {
  bloodType: string;
  allergies: string[];
  conditions: string[];
  iceContacts: Array<{ name: string; phone: string; relation: string }>;
  organDonor: boolean;
}

export function PulsePage() {
  const { userId } = useParams();
  const [info, setInfo] = useState<EmergencyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchInfo = async () => {
      try {
        const snap = await getDoc(doc(db, "emergency_info", userId));
        if (snap.exists()) {
          setInfo(snap.data() as EmergencyInfo);
        } else {
          setError(true);
        }
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-4">
      <Loader2 className="animate-spin text-[#E11D48]" size={40} />
      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Accessing Clinical Data...</p>
    </div>
  );

  if (error || !info) return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <AlertCircle className="text-rose-500" size={48} />
      <h1 className="text-2xl font-black text-slate-900">Medical ID Not Found</h1>
      <p className="text-slate-600 font-medium leading-relaxed">
        The requested medical profile is either private or does not exist. 
        If this is an emergency, please check the patient's physical ID.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-slate-950 font-inter">
      {/* High Contrast Emergency Header */}
      <header className="bg-rose-600 p-8 text-white space-y-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <ShieldAlert size={28} />
             <h1 className="text-2xl font-black font-lexend uppercase tracking-tighter">Emergency Hub</h1>
          </div>
          <Activity className="animate-pulse" size={20} />
        </div>
        <div className="pt-4 border-t border-white/20">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Status</p>
          <div className="flex items-center gap-2">
            <div className="size-2 bg-emerald-400 rounded-full animate-ping" />
            <span className="text-sm font-bold tracking-tight">Active Pulse Profile</span>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-8">
        {/* Blood Type - Giant & Clear */}
        <section className="bg-slate-50 p-8 rounded-[2.5rem] flex items-center justify-between border border-slate-100">
           <div className="space-y-1">
              <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Blood Type</span>
              <h2 className="text-6xl font-black font-lexend tracking-tighter text-slate-900">{info.bloodType}</h2>
           </div>
           <div className="size-20 bg-rose-100 rounded-3xl flex items-center justify-center text-rose-600">
             <Droplets size={40} fill="currentColor" />
           </div>
        </section>

        {/* Critical Alerts */}
        <section className="space-y-4">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Critical Medical Alerts</h3>
           
           {info.allergies.length > 0 && (
            <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-200">
                <div className="flex items-center gap-2 text-amber-700 mb-3">
                  <AlertCircle size={20} />
                  <span className="font-black text-sm uppercase">Known Allergies</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {info.allergies.map(a => (
                    <span key={a} className="px-4 py-2 bg-white rounded-xl border border-amber-200 font-black text-amber-700 text-sm">{a}</span>
                  ))}
                </div>
            </div>
           )}

           {info.conditions.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <Info size={20} />
                  <span className="font-black text-sm uppercase">Medical Conditions</span>
                </div>
                <div className="space-y-2">
                  {info.conditions.map(c => (
                    <p key={c} className="font-bold text-lg leading-tight">{c}</p>
                  ))}
                </div>
            </div>
           )}

           <div className={cn(
             "p-6 rounded-[2rem] flex items-center justify-between border",
             info.organDonor ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-100 text-slate-500"
           )}>
              <div className="flex items-center gap-3">
                <Heart size={20} className={info.organDonor ? "text-emerald-600" : "text-slate-400"} fill="currentColor" />
                <span className="font-black text-sm uppercase">Organ Donor</span>
              </div>
              <span className="font-lexend font-black text-lg">{info.organDonor ? "YES" : "NO"}</span>
           </div>
        </section>

        {/* ICE Contacts - Massive Dial Buttons */}
        <section className="space-y-4">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">In Case of Emergency</h3>
           <div className="space-y-3">
              {info.iceContacts.map((contact, i) => (
                <a 
                  key={i} 
                  href={`tel:${contact.phone}`}
                  className="w-full flex items-center justify-between p-6 bg-emerald-600 rounded-[2.5rem] text-white shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center">
                      <User size={32} />
                    </div>
                    <div className="text-left">
                       <h4 className="text-xl font-black font-lexend leading-tight">{contact.name}</h4>
                       <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest">{contact.relation}</p>
                    </div>
                  </div>
                  <Phone size={28} />
                </a>
              ))}
           </div>
        </section>

        <footer className="text-center pt-8 pb-12 space-y-2 opacity-30">
           <ShieldAlert className="mx-auto" size={24} />
           <p className="text-[10px] font-black uppercase tracking-[0.3em]">Universal Health OS</p>
        </footer>
      </main>
    </div>
  );
}
