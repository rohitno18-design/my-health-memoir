import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, Phone, Droplets, AlertCircle, 
  Heart, X, Check, Loader2, 
  Settings, Zap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, setDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface EmergencyInfo {
  bloodType: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  iceContacts: Array<{ name: string; phone: string; relation: string }>;
  organDonor: boolean;
  notifiedOnSOS: boolean;
}

export function EmergencyPage() {
  const { user } = useAuth();
  const [info, setInfo] = useState<EmergencyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isSOSActive, setIsSOSActive] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "emergency_info", user.uid), (snap) => {
      if (snap.exists()) {
        setInfo(snap.data() as EmergencyInfo);
      } else {
        const defaultInfo: EmergencyInfo = {
          bloodType: "Not Set",
          allergies: [],
          conditions: [],
          medications: [],
          iceContacts: [],
          organDonor: false,
          notifiedOnSOS: true
        };
        setDoc(doc(db, "emergency_info", user.uid), defaultInfo);
        setInfo(defaultInfo);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const pulseUrl = `${window.location.origin}/pulse/${user?.uid}`;

  const handleSOS = () => {
    setIsSOSActive(true);
    // In a real app, this would trigger SMS/Push notifications via a cloud function
    console.log("SOS TRIGGERED for", user?.uid);
    setTimeout(() => setIsSOSActive(false), 5000);
  };

  if (loading) return <div className="min-h-screen bg-[#0b1326] flex items-center justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>;

  return (
    <div className="min-h-screen bg-[#0b1326] text-white pb-32">
      {/* Premium Background Gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[50%] bg-[#E11D48]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-[#10B981]/5 blur-[100px] rounded-full" />
      </div>

      <header className="sticky top-0 z-40 px-6 py-6 flex items-center justify-between bg-[#0b1326]/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/20">
             <ShieldAlert className="text-rose-500" size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tight font-lexend">Clinical Sentinel</h1>
        </div>
        <button onClick={() => setEditing(true)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <Settings size={20} className="text-slate-400" />
        </button>
      </header>

      <main className="px-6 pt-8 space-y-10 relative z-10">
        {/* Medical QR Card */}
        <section className="flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[320px] p-8 rounded-[2.5rem] bg-[#171f33] border border-white/10 shadow-2xl relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="bg-white p-6 rounded-[2rem] shadow-inner mb-6 flex items-center justify-center">
              <QRCodeSVG 
                value={pulseUrl} 
                size={200}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "/shield-logo.png", // Fallback text/icon can be used too
                  x: undefined,
                  y: undefined,
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xs font-black text-rose-500 uppercase tracking-[0.2em]">Paramedic Scan</p>
              <h3 className="text-lg font-bold text-slate-200">Emergency Medical Profile</h3>
            </div>
          </motion.div>
          <p className="mt-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center px-12 leading-relaxed">
            First responders can scan this to see blood type, ICE contacts, and critical allergies.
          </p>
        </section>

        {/* SOS Action */}
        <section className="flex justify-center flex-col items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSOS}
            className={cn(
              "size-24 rounded-full flex flex-col items-center justify-center gap-1 shadow-2xl transition-all duration-500",
              isSOSActive ? "bg-rose-600 scale-110 shadow-rose-500/50" : "bg-rose-500 shadow-rose-500/30"
            )}
          >
            <Zap className={cn("text-white transition-all", isSOSActive ? "animate-pulse" : "")} fill="currentColor" size={28} />
            <span className="text-[10px] font-black tracking-widest uppercase">SOS</span>
          </motion.button>
          <p className="text-xs font-bold text-rose-600/80 uppercase tracking-widest">
            {isSOSActive ? "Notifying Contacts..." : "Hold for Emergency"}
          </p>
        </section>

        {/* Critical Info Bento */}
        <section className="grid grid-cols-2 gap-4">
           <div className="col-span-1 p-6 rounded-[2rem] bg-[#131b2e] border border-white/5 space-y-4">
              <div className="flex items-center gap-2 text-rose-500">
                <Droplets size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Blood</span>
              </div>
              <h4 className="text-3xl font-black font-lexend">{info?.bloodType}</h4>
           </div>
           <div className="col-span-1 p-6 rounded-[2rem] bg-[#131b2e] border border-white/5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-500">
                <Heart size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Donor</span>
              </div>
              <h4 className="text-lg font-black font-lexend mt-2">{info?.organDonor ? "Registered" : "Not Set"}</h4>
           </div>

           <div className="col-span-2 p-6 rounded-[2rem] bg-[#131b2e] border border-white/5">
              <div className="flex items-center gap-2 text-amber-500 mb-4">
                <AlertCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Critical Allergies</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {info?.allergies.length ? info.allergies.map(a => (
                  <span key={a} className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/20">{a}</span>
                )) : <span className="text-slate-500 text-xs italic font-medium">No allergies reported</span>}
              </div>
           </div>
        </section>

        {/* ICE Contacts */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">In Case of Emergency</h3>
             <button onClick={() => setEditing(true)} className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Edit List</button>
          </div>
          <div className="space-y-3">
             {info?.iceContacts.length ? info.iceContacts.map((contact, i) => (
                <div key={i} className="p-5 rounded-[2rem] bg-[#171f33] border border-white/5 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                      {contact.name[0]}
                    </div>
                    <div>
                       <h5 className="font-bold text-slate-200">{contact.name}</h5>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{contact.relation}</p>
                    </div>
                  </div>
                  <a href={`tel:${contact.phone}`} className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all">
                    <Phone size={20} />
                  </a>
                </div>
             )) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-[2rem] border border-dashed border-slate-800">
                <p className="text-sm text-slate-500 font-medium">No emergency contacts added yet.</p>
              </div>
             )}
          </div>
        </section>

        {/* Legal Disclaimer */}
        <p className="text-[10px] text-slate-600 text-center pb-8 leading-relaxed px-6">
          This Medical Profile is intended for emergency use only. Universal Health OS does not guarantee immediate response but provides data visualization tools for medical professionals.
        </p>
      </main>

      {/* Edit Modal (Sheet) */}
      <AnimatePresence>
        {editing && (
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#0b1326] flex flex-col"
          >
            <header className="p-6 flex items-center justify-between border-b border-white/5">
              <h2 className="text-xl font-black font-lexend">Edit Profile</h2>
              <button onClick={() => setEditing(false)} className="size-10 bg-slate-900 rounded-full flex items-center justify-center"><X size={20} /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Blood Type</label>
                  <select 
                    value={info?.bloodType} 
                    onChange={e => updateDoc(doc(db, "emergency_info", user!.uid), { bloodType: e.target.value })}
                    className="w-full mt-2 p-4 rounded-2xl bg-slate-900 border border-white/5 text-white font-bold"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not Set"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-white/5">
                   <div>
                     <p className="font-bold">Organ Donor</p>
                     <p className="text-[10px] text-slate-500">Publicly show donor status</p>
                   </div>
                   <button 
                    onClick={() => updateDoc(doc(db, "emergency_info", user!.uid), { organDonor: !info?.organDonor })}
                    className={cn("size-6 rounded flex items-center justify-center transition-colors", info?.organDonor ? "bg-emerald-500" : "bg-slate-700")}
                   >
                     {info?.organDonor && <Check size={16} />}
                   </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Critical Conditions & Allergies</h3>
                <p className="text-xs text-slate-600 px-1">Use the medical vault to add records. For now, enter comma-separated values.</p>
                <textarea 
                  placeholder="Peanuts, Penicillin..."
                  className="w-full p-4 rounded-2xl bg-slate-900 border border-white/5 text-white font-medium min-h-[100px]"
                  defaultValue={info?.allergies.join(", ")}
                  onBlur={e => updateDoc(doc(db, "emergency_info", user!.uid), { allergies: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
                />
              </div>
            </div>
            <div className="p-6 bg-gradient-to-t from-[#0b1326] via-[#0b1326] to-transparent absolute bottom-0 left-0 right-0">
               <button onClick={() => setEditing(false)} className="w-full py-4 bg-emerald-600 rounded-2xl font-black shadow-lg shadow-emerald-500/20">
                 Save & Return
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
