import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert, Phone, Droplets, AlertCircle,
  Heart, Loader2, Siren, UserCheck, Users,
  Activity, Pill, User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, query, collection, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface EmergencyInfo {
  bloodType: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  iceContacts: Array<{ name: string; phone: string; relation: string }>;
  organDonor: boolean;
  notifiedOnSOS: boolean;
  userId?: string;
}

export function EmergencyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<EmergencyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  // Load patient list
  useEffect(() => {
    if (!user) return;
    const unsubPatients = onSnapshot(
      query(collection(db, "patients"), where("userId", "==", user.uid)),
      (snap) => {
        const pats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPatients(pats);
        if (pats.length > 0 && !selectedPatientId) {
          setSelectedPatientId(pats[0].id);
        }
      }
    );
    return () => unsubPatients();
  }, [user]);

  // Load emergency info for selected patient
  useEffect(() => {
    if (!user || !selectedPatientId) { setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, "emergency_info", selectedPatientId), (snap) => {
      if (snap.exists()) {
        setInfo(snap.data() as EmergencyInfo);
      } else {
        // Create a blank record WITH userId so future updates work
        const blank: EmergencyInfo & { userId: string } = {
          bloodType: "",
          allergies: [],
          conditions: [],
          medications: [],
          iceContacts: [],
          organDonor: false,
          notifiedOnSOS: true,
          userId: user.uid,
        };
        setDoc(doc(db, "emergency_info", selectedPatientId), blank);
        setInfo(blank);
      }
      setLoading(false);
    }, (err) => {
      console.error("Emergency info error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [user, selectedPatientId]);

  const pulseUrl = `${window.location.origin}/pulse/${selectedPatientId}`;
  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handleSOS = () => {
    setIsSOSActive(true);
    setTimeout(() => setIsSOSActive(false), 5000);
  };

  const hasNoData = !info?.bloodType && (!info?.allergies || info.allergies.length === 0) &&
    (!info?.conditions || info.conditions.length === 0) && (!info?.iceContacts || info.iceContacts.length === 0);

  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)" }}>
      <Loader2 className="animate-spin text-rose-400" size={32} />
    </div>
  );

  return (
    <div className="min-h-dvh pb-32" style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 100%)" }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute top-0 right-0 w-[60%] h-[30%] bg-rose-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[25%] left-0 w-[40%] h-[25%] bg-emerald-500/8 blur-[100px] rounded-full" />
      </div>

      {/* ─── Header ─── */}
      <div className="relative z-10 px-5 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
            <ShieldAlert className="text-rose-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">{t("emergency.title")}</h1>
            <p className="text-[11px] font-semibold text-rose-400/70 uppercase tracking-widest">{t("emergency.subtitle")}</p>
          </div>
        </div>

        {patients.length > 1 && (
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="appearance-none bg-white/10 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer backdrop-blur-sm"
          >
            {patients.map(p => (
              <option key={p.id} value={p.id} className="bg-slate-800 text-white">{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {patients.length === 0 ? (
        /* ─── Empty State ─── */
        <div className="relative z-10 py-20 text-center px-8 flex flex-col items-center">
          <div className="size-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
            <Users size={36} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{t("patients.noProfiles")}</h3>
          <p className="text-sm text-slate-400 mb-6">{t("patients.emptyDesc")}</p>
          <button
            onClick={() => navigate("/patients")}
            className="bg-emerald-500 text-white text-sm font-black px-8 py-3.5 rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            {t("patients.title")} →
          </button>
        </div>
      ) : (
        <main className="relative z-10 px-5 space-y-4">

          {/* ─── Patient name pill ─── */}
          {selectedPatient && (
            <div className="flex justify-center">
              <span className="bg-white/10 border border-white/15 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                👤 {selectedPatient.name}
              </span>
            </div>
          )}

          {/* ─── No data warning ─── */}
          {hasNoData && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex gap-3">
              <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-300">{t("emergency.emptyWarn")}</p>
                <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
                  {t("emergency.emptyDesc")}
                </p>
                <button onClick={() => navigate("/patients")} className="mt-2 text-xs font-black text-amber-300 hover:text-amber-200 underline">
                  {t("emergency.addInfo")} →
                </button>
              </div>
            </div>
          )}

          {/* ─── QR Code — BIG & centered ─── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1 text-center">{t("emergency.paramedicId")}</p>
            <div className="bg-white rounded-[3rem] p-8 flex flex-col items-center gap-6 shadow-xl border border-slate-100">

              {/* Patient identity — Large & Centered */}
              <div className="flex flex-col items-center text-center space-y-4 w-full">
                <div className="size-32 rounded-3xl overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center border-2 border-slate-200 shadow-md">
                  {selectedPatient?.photoURL ? (
                    <img src={selectedPatient.photoURL} alt={selectedPatient.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={56} className="text-slate-400" />
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="font-black text-slate-900 text-2xl leading-tight tracking-tight">
                    {selectedPatient?.name || t("patients.label")}
                  </h2>
                  <div className="flex items-center justify-center gap-2">
                    {selectedPatient?.bloodGroup && (
                      <span className="bg-rose-50 text-rose-600 text-xs font-black px-4 py-1.5 rounded-full border border-rose-100">
                        🩸 {selectedPatient.bloodGroup}
                      </span>
                    )}
                    {selectedPatient?.gender && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-4 py-1.5 rounded-full">
                        {selectedPatient.gender}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* QR Code section */}
              <div
                className="cursor-pointer active:scale-95 transition-transform p-4 bg-slate-50 rounded-[2.5rem] border border-slate-100"
                onClick={() => window.open(pulseUrl, '_blank')}
                title="Open paramedic view"
              >
                <QRCodeSVG
                  value={pulseUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <p className="text-xs text-slate-400 text-center">{t("emergency.tapToPreview")}</p>
              <button
                onClick={() => window.open(pulseUrl, '_blank')}
                className="w-full py-2.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                {t("common.edit")} →
              </button>
            </div>
          </motion.section>

          {/* ─── SOS Button ─── */}
          <section className="flex flex-col items-center gap-3 py-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSOS}
              className={cn(
                "size-24 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-200 border-4 shadow-2xl",
                isSOSActive
                  ? "bg-rose-600 border-rose-400 shadow-rose-500/60 scale-110"
                  : "bg-rose-500 border-rose-300/40 shadow-rose-500/30"
              )}
            >
              <Siren className={cn("text-white", isSOSActive && "animate-bounce")} fill="currentColor" size={26} />
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white">{t("emergency.sosButton")}</span>
            </motion.button>
            <p className={cn("text-xs font-black uppercase tracking-widest", isSOSActive ? "text-rose-400 animate-pulse" : "text-slate-500")}>
              {isSOSActive ? t("emergency.sosDesc") : t("emergency.sosButton")}
            </p>
          </section>

          {/* ─── Critical Medical Info ─── */}
          <section>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">{t("emergency.criticalInfo")}</p>
            <div className="grid grid-cols-2 gap-3">

              {/* Blood Type */}
              <div className="bg-white/6 border border-white/12 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets size={13} className="text-rose-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("emergency.bloodGroup")}</span>
                </div>
                <span className={cn(
                  "text-3xl font-black block",
                  info?.bloodType ? "text-white" : "text-slate-600 text-lg"
                )}>
                  {info?.bloodType || t("common.notSet")}
                </span>
              </div>

              {/* Organ Donor */}
              <div className="bg-white/6 border border-white/12 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={13} className="text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("emergency.organDonor")}</span>
                </div>
                <span className={cn(
                  "font-black block text-base mt-1",
                  info?.organDonor ? "text-emerald-400" : "text-slate-500 text-sm"
                )}>
                  {info?.organDonor ? t("emergency.yes") : t("emergency.no")}
                </span>
              </div>

              {/* Allergies */}
              <div className="col-span-2 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={13} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest">{t("emergency.criticalAllergies")}</span>
                </div>
                {info?.allergies && info.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {info.allergies.map(a => (
                      <span key={a} className="px-3 py-1.5 rounded-xl bg-amber-400/15 text-amber-200 text-xs font-bold border border-amber-400/25">
                        ⚠ {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm font-medium">{t("common.notSpecified")}</p>
                )}
              </div>

              {/* Conditions */}
              {info?.conditions && info.conditions.length > 0 && (
                <div className="col-span-2 bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={13} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest">{t("emergency.conditions")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.conditions.map(c => (
                      <span key={c} className="px-3 py-1.5 rounded-xl bg-blue-400/15 text-blue-200 text-xs font-bold border border-blue-400/25">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Medications */}
              {info?.medications && info.medications.length > 0 && (
                <div className="col-span-2 bg-violet-500/8 border border-violet-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Pill size={13} className="text-violet-400" />
                    <span className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest">{t("emergency.medications")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.medications.map(m => (
                      <span key={m} className="px-3 py-1.5 rounded-xl bg-violet-400/15 text-violet-200 text-xs font-bold border border-violet-400/25">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ─── ICE Contacts ─── */}
          <section className="space-y-3 pb-6">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <UserCheck size={12} /> {t("emergency.iceContacts")}
            </p>
            {info?.iceContacts && info.iceContacts.length > 0 ? (
              info.iceContacts.map((contact, i) => (
                <div key={i} className="bg-white/6 border border-white/12 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center font-black text-emerald-400 text-lg">
                      {contact.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{contact.name}</h5>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{contact.relation || t("emergency.contactRelation")}</p>
                      {contact.phone && <p className="text-xs text-slate-300 mt-0.5">{contact.phone}</p>}
                    </div>
                  </div>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="size-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                      <Phone size={18} />
                    </a>
                  ) : (
                    <div className="size-11 rounded-xl bg-white/5 border border-white/10 text-slate-600 flex items-center justify-center">
                      <Phone size={18} />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center bg-white/5 border border-dashed border-white/15 rounded-2xl">
                <UserCheck size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 font-medium">{t("emergency.noIce")}</p>
                <button
                  onClick={() => navigate("/patients")}
                  className="mt-2 text-xs text-emerald-400 font-bold hover:underline"
                >
                  {t("emergency.addIceBtn")}
                </button>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
