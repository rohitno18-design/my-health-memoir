import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Heart, Droplets, Plus, 
  ArrowUpRight, ArrowDownRight, Loader2, X, Check,
  History
} from "lucide-react";
import { 
  AreaChart, Area, Tooltip, ResponsiveContainer
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, orderBy, limit, 
  onSnapshot, addDoc, serverTimestamp, Timestamp 
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type VitalType = "Glucose" | "Blood Pressure" | "Heart Rate";

interface VitalLog {
  id: string;
  type: VitalType;
  value: string | number;
  unit: string;
  timestamp: Timestamp;
  note?: string;
}

const VITAL_CONFIG = {
  "Glucose": { unit: "mg/dL", color: "#10B981", icon: Droplets, bg: "bg-emerald-500/10" },
  "Blood Pressure": { unit: "mmHg", color: "#3B82F6", icon: Activity, bg: "bg-blue-500/10" },
  "Heart Rate": { unit: "bpm", color: "#F43F5E", icon: Heart, bg: "bg-rose-500/10" }
};

export function VitalsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<VitalType>("Glucose");
  const [logs, setLogs] = useState<VitalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("self");

  useEffect(() => {
    if (!user) return;
    const unsubPatients = onSnapshot(query(collection(db, "patients"), where("userId", "==", user.uid)), (snap) => {
        setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubPatients();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const currentPatientId = selectedPatientId === "self" ? user.uid : selectedPatientId;
    const q = query(
      collection(db, "vitals"),
      where("userId", "==", user.uid),
      where("type", "==", activeTab),
      where("patientId", "==", currentPatientId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as VitalLog));
      setLogs(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user, activeTab]);

  const chartData = [...logs].reverse().map(log => ({
    time: format(log.timestamp.toDate(), "MMM d"),
    value: typeof log.value === "string" ? parseInt(log.value.split("/")[0]) : log.value
  }));

  const average = logs.length > 0 
    ? Math.round(chartData.reduce((acc, curr) => acc + curr.value, 0) / chartData.length)
    : 0;

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newVal) return;
    setIsSaving(true);
    const currentPatientId = selectedPatientId === "self" ? user.uid : selectedPatientId;
    try {
      await addDoc(collection(db, "vitals"), {
        userId: user.uid,
        patientId: currentPatientId,
        type: activeTab,
        value: newVal,
        unit: VITAL_CONFIG[activeTab].unit,
        timestamp: serverTimestamp()
      });
      setIsLogModalOpen(false);
      setNewVal("");
      alert(`${activeTab} saved successfully for ${selectedPatientId === 'self' ? 'You' : patients.find(p=>p.id===selectedPatientId)?.name || 'Patient'}!`);
    } catch (e: any) {
      console.error(e);
      alert("Failed to save vital: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const ActiveIcon = VITAL_CONFIG[activeTab].icon;

  return (
    <div className="min-h-screen bg-[#0b1326] text-white pb-32 font-inter">
      {/* Premium Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-full h-[40%] bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-full h-[30%] bg-blue-500/5 blur-[100px]" />
      </div>

      <header className="px-6 py-8 space-y-6 relative z-10">
        <div className="flex items-center justify-between">
           <div>
              <h1 className="text-3xl font-black font-lexend tracking-tighter">Vitals Analytics</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Slate Guardian Monitoring</p>
           </div>
           
           {/* Profile Selector */}
           <div className="relative group">
              <select 
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="appearance-none bg-[#171f33] border border-white/10 text-white text-xs font-bold font-lexend px-4 py-2 pr-8 rounded-full shadow-lg outline-none focus:border-emerald-500/50 transition-colors"
              >
                <option value="self">My Vitals</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}'s Vitals</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowDownRight size={14} className="text-emerald-500" />
              </div>
           </div>
        </div>

        {/* Segmented Control */}
        <div className="flex bg-[#171f33] p-1.5 rounded-2xl border border-white/5">
          {(["Glucose", "Blood Pressure", "Heart Rate"] as VitalType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                activeTab === tab ? "bg-white text-slate-900 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {tab === "Blood Pressure" ? "BP" : tab}
            </button>
          ))}
        </div>
      </header>

      <main className="px-6 space-y-6 relative z-10">
        {/* Feature Chart Card */}
        <section className="p-6 rounded-[2.5rem] bg-[#171f33] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
                <div className={cn("size-10 rounded-xl flex items-center justify-center text-white", VITAL_CONFIG[activeTab].bg)}>
                   <ActiveIcon size={20} style={{ color: VITAL_CONFIG[activeTab].color }} />
                </div>
                <div>
                   <h3 className="font-bold text-slate-200">{activeTab} Trend</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last 7 Days</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Daily Avg</p>
                <div className="flex items-end gap-1">
                   <span className="text-2xl font-black font-lexend text-white leading-none">{average}</span>
                   <span className="text-[10px] font-bold text-slate-400 mb-0.5">{VITAL_CONFIG[activeTab].unit}</span>
                </div>
             </div>
          </div>

          <div className="h-[200px] w-full -ml-4">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                   <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor={VITAL_CONFIG[activeTab].color} stopOpacity={0.3}/>
                         <stop offset="95%" stopColor={VITAL_CONFIG[activeTab].color} stopOpacity={0}/>
                      </linearGradient>
                   </defs>
                   <Tooltip 
                     contentStyle={{ backgroundColor: "#171f33", border: "none", borderRadius: "12px", fontSize: "10px", color: "#fff" }}
                     itemStyle={{ color: VITAL_CONFIG[activeTab].color }}
                   />
                   <Area 
                     type="monotone" 
                     dataKey="value" 
                     stroke={VITAL_CONFIG[activeTab].color} 
                     strokeWidth={3}
                     fillOpacity={1} 
                     fill="url(#colorVal)" 
                   />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </section>

        {/* Recent Logs List */}
        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <History size={14} /> Recent Logs
              </h3>
              <button 
                onClick={() => setIsLogModalOpen(true)}
                className="size-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
              >
                <Plus size={20} />
              </button>
           </div>

           <div className="space-y-3">
              {loading ? (
                <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>
              ) : logs.length > 0 ? logs.map((log, i) => (
                <div key={log.id} className="p-5 rounded-[2rem] bg-[#131b2e] border border-white/5 flex items-center justify-between group">
                   <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-white/5 flex flex-col items-center justify-center">
                         <span className="text-[10px] font-black">{format(log.timestamp.toDate(), "dd")}</span>
                         <span className="text-[8px] font-black uppercase text-slate-500">{format(log.timestamp.toDate(), "MMM")}</span>
                      </div>
                      <div>
                         <h4 className="font-lexend font-black text-lg leading-tight flex items-center gap-1">
                           {log.value} <span className="text-[10px] font-bold text-slate-500 uppercase">{log.unit}</span>
                         </h4>
                         <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{format(log.timestamp.toDate(), "hh:mm a")}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 pr-2">
                      {i < logs.length - 1 && (
                        Number(log.value) > Number(logs[i+1].value) 
                        ? <ArrowUpRight className="text-rose-500" size={16} />
                        : <ArrowDownRight className="text-emerald-500" size={16} />
                      )}
                   </div>
                </div>
              )) : (
                <div className="py-12 text-center text-slate-600 italic text-sm">No records found for {activeTab}.</div>
              )}
           </div>
        </section>
      </main>

      {/* Log New Vital Modal */}
      <AnimatePresence>
        {isLogModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsLogModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="relative bg-[#0b1326] rounded-t-[3rem] p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black font-lexend">Log {activeTab}</h3>
                <button onClick={() => setIsLogModalOpen(false)} className="size-10 bg-slate-900 rounded-full flex items-center justify-center"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleAddLog} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Value ({VITAL_CONFIG[activeTab].unit})</label>
                    <input 
                      autoFocus
                      type={activeTab === "Blood Pressure" ? "text" : "number"}
                      placeholder={activeTab === "Blood Pressure" ? "120/80" : "0.0"}
                      value={newVal}
                      step="any"
                      onChange={e => setNewVal(e.target.value)}
                      className="w-full p-6 rounded-3xl bg-slate-900 border border-white/5 text-3xl font-black font-lexend text-center focus:border-emerald-500/50 transition-all outline-none"
                    />
                 </div>
                 <button 
                   disabled={isSaving || !newVal}
                   className="w-full py-5 bg-emerald-600 rounded-3xl font-black shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 transition-transform"
                 >
                   {isSaving ? <Loader2 className="animate-spin" /> : <Check size={20} />}
                   Save Reading
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
