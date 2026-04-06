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
  onSnapshot, addDoc, serverTimestamp
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

type VitalType = "Sugar" | "Blood Pressure" | "Heart Rate";

interface VitalLog {
  id: string;
  type: VitalType;
  value: string | number;
  unit: string;
  timestamp: any;
  note?: string;
}

const HEALTH_RANGES = {
  "Sugar": [
    { max: 70, label: "low", color: "#F97316", bg: "bg-orange-100", text: "text-orange-600" },
    { max: 100, label: "normal", color: "#10B981", bg: "bg-emerald-100", text: "text-emerald-600" },
    { max: 125, label: "preDiabetic", color: "#F59E0B", bg: "bg-amber-100", text: "text-amber-600" },
    { max: Infinity, label: "high", color: "#EF4444", bg: "bg-rose-100", text: "text-rose-600" },
  ],
  "Blood Pressure": [
    { max: 90, label: "low", color: "#F97316", bg: "bg-orange-100", text: "text-orange-600" },
    { max: 120, label: "normal", color: "#10B981", bg: "bg-emerald-100", text: "text-emerald-600" },
    { max: 130, label: "elevated", color: "#F59E0B", bg: "bg-amber-100", text: "text-amber-600" },
    { max: 140, label: "high", color: "#F97316", bg: "bg-orange-100", text: "text-orange-600" },
    { max: Infinity, label: "hypertensive", color: "#EF4444", bg: "bg-rose-100", text: "text-rose-600" },
  ],
  "Heart Rate": [
    { max: 60, label: "low", color: "#F97316", bg: "bg-orange-100", text: "text-orange-600" },
    { max: 100, label: "normal", color: "#10B981", bg: "bg-emerald-100", text: "text-emerald-600" },
    { max: Infinity, label: "high", color: "#EF4444", bg: "bg-rose-100", text: "text-rose-600" },
  ],
} as const;

function getHealthStatus(type: VitalType, value: number) {
  const ranges = HEALTH_RANGES[type];
  return ranges.find(r => value < r.max) ?? ranges[ranges.length - 1];
}

const VITAL_CONFIG = {
  "Sugar": { unit: "mg/dL", color: "#10B981", icon: Droplets, bg: "bg-emerald-50", tKey: "sugar" },
  "Blood Pressure": { unit: "mmHg", color: "#3B82F6", icon: Activity, bg: "bg-blue-50", tKey: "bp" },
  "Heart Rate": { unit: "bpm", color: "#F43F5E", icon: Heart, bg: "bg-rose-50", tKey: "heartRate" }
};

export function VitalsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<VitalType>("Sugar");
  const [logs, setLogs] = useState<VitalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [newVal, setNewVal] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const unsubPatients = onSnapshot(query(collection(db, "patients"), where("userId", "==", user.uid)), (snap) => {
        const pats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPatients(pats);
        if (pats.length > 0 && !selectedPatientId) {
           setSelectedPatientId(pats[0].id);
        }
    });
    return () => unsubPatients();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedPatientId) { setLoading(false); return; }
    setLoading(true);
    const q = query(
      collection(db, "vitals"),
      where("userId", "==", user.uid),
      where("type", "==", activeTab),
      where("patientId", "==", selectedPatientId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .filter(d => !d.metadata.hasPendingWrites)
        .map(d => ({ id: d.id, ...d.data() } as VitalLog));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.error("Vitals snapshot error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, activeTab, selectedPatientId]);

  const validLogs = logs.filter(log => log.timestamp != null);

  const chartData = [...validLogs].reverse().map(log => ({
    time: format(log.timestamp.toDate(), "MMM d"),
    value: typeof log.value === "string" ? parseInt(log.value.split("/")[0]) || 0 : log.value
  }));

  const latestValue = validLogs.length > 0
    ? (typeof validLogs[0].value === "string" ? parseInt(validLogs[0].value.split("/")[0]) || 0 : validLogs[0].value as number)
    : 0;

  const healthStatus = latestValue > 0 ? getHealthStatus(activeTab, latestValue) : null;

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newVal || !selectedPatientId) return;
    setIsSaving(true);
    setIsLogModalOpen(false);
    setNewVal("");
    try {
      await addDoc(collection(db, "vitals"), {
        userId: user.uid,
        patientId: selectedPatientId,
        type: activeTab,
        value: newVal,
        unit: VITAL_CONFIG[activeTab].unit,
        timestamp: serverTimestamp()
      });
    } catch (e: any) {
      console.error(e);
      alert(t("common.error") + ": " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const ActiveIcon = VITAL_CONFIG[activeTab].icon;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-32">
      <div className="bg-white border-b border-slate-100 px-5 pt-5 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{t("vitals.title")}</h1>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">{t("vitals.subtitle")}</p>
          </div>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="appearance-none bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl outline-none focus:border-emerald-400 cursor-pointer"
            disabled={patients.length === 0}
          >
            {patients.length === 0 && <option value="">{t("vitals.selectPatient")}</option>}
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          {(["Sugar", "Blood Pressure", "Heart Rate"] as VitalType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {t(`vitals.${VITAL_CONFIG[tab].tKey}`)}
            </button>
          ))}
        </div>
      </div>

      <main className="px-5 py-5 space-y-5">
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn("size-11 rounded-2xl flex items-center justify-center", VITAL_CONFIG[activeTab].bg)}>
                <ActiveIcon size={20} style={{ color: VITAL_CONFIG[activeTab].color }} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{t(`vitals.${VITAL_CONFIG[activeTab].tKey}`)}</h3>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{t("vitals.history")}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">{t("vitals.latest")}</p>
              <div className="flex items-end gap-1 justify-end">
                <span className="text-3xl font-black text-slate-900 leading-none">{latestValue > 0 ? latestValue : "—"}</span>
                {latestValue > 0 && <span className="text-[10px] font-semibold text-slate-400 mb-0.5">{VITAL_CONFIG[activeTab].unit}</span>}
              </div>
            </div>
          </div>

          {healthStatus && latestValue > 0 && (
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl mb-3", healthStatus.bg)}>
              <span className="size-2 rounded-full animate-pulse" style={{ backgroundColor: healthStatus.color }} />
              <span className={cn("text-xs font-black", healthStatus.text)}>
                {t(`vitals.${healthStatus.label}`)}
              </span>
            </div>
          )}

          {chartData.length > 0 ? (
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={VITAL_CONFIG[activeTab].color} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={VITAL_CONFIG[activeTab].color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)" }}
                    itemStyle={{ color: VITAL_CONFIG[activeTab].color, fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={VITAL_CONFIG[activeTab].color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm font-medium">{t("vitals.history")}</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History size={13} /> {t("vitals.history")}
            </h3>
            <button
              onClick={() => setIsLogModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
            >
              <Plus size={14} /> {t("vitals.addReading")}
            </button>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-emerald-400" size={24} /></div>
          ) : logs.length > 0 ? logs.map((log, i) => (
            <div key={log.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center">
                  <span className="text-sm font-black text-slate-800">{format(log.timestamp.toDate(), "dd")}</span>
                  <span className="text-[9px] font-bold uppercase text-slate-400">{format(log.timestamp.toDate(), "MMM")}</span>
                </div>
                <div>
                  <h4 className="font-black text-xl text-slate-900 leading-tight">
                    {log.value} <span className="text-[11px] font-semibold text-slate-400">{log.unit}</span>
                  </h4>
                  <p className="text-[11px] font-medium text-slate-400">{format(log.timestamp.toDate(), "hh:mm a")}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="py-10 text-center text-slate-400 text-sm">
              {t("vitals.noHistory")}
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {isLogModalOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsLogModalOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="relative bg-white rounded-t-[2.5rem] px-6 pt-4 pb-28 space-y-5 shadow-2xl"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{t("vitals.addReading")}</h3>
                </div>
                <button onClick={() => setIsLogModalOpen(false)} className="size-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddLog} className="space-y-4">
                <input
                  autoFocus
                  type="text"
                  placeholder={t("vitals.enterValue")}
                  value={newVal}
                  onChange={e => setNewVal(e.target.value)}
                  className="w-full py-4 px-6 rounded-2xl bg-slate-50 border border-slate-200 text-2xl font-black text-slate-900 outline-none"
                />
                <button
                  type="submit"
                  disabled={isSaving || !newVal || !selectedPatientId}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  {t("vitals.saveReading")}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
