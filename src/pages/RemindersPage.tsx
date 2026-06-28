import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Bell, Pill, CalendarDays, Clock, Trash2, X, Activity, Repeat, Volume2, Edit2, Copy, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslation } from "react-i18next";

export function RemindersPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [patientId, setPatientId] = useState("");
  const [type, setType] = useState("medicine"); // medicine, appointment, other
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");
  const [repeat, setRepeat] = useState("none"); // none, daily, weekly, monthly, yearly
  const [sound, setSound] = useState("beep"); // beep, radar, siren, chime

  useEffect(() => {
    if (!user) return;
    
    // Fetch patients
    const qPatients = query(collection(db, "patients"), where("userId", "==", user.uid));
    const unsubPatients = onSnapshot(qPatients, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPatients(data);
      if (data.length > 0 && !patientId) setPatientId(data[0].id);
    });

    // Fetch reminders
    const qReminders = query(collection(db, "reminders"), where("userId", "==", user.uid));
    const unsubReminders = onSnapshot(qReminders, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by datetime
      data.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      setReminders(data);
    });

    return () => {
      unsubPatients();
      unsubReminders();
    };
  }, [user]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !date) return;

    setIsSubmitting(true);
    try {
      let hh = parseInt(hour, 10);
      if (ampm === "PM" && hh !== 12) hh += 12;
      if (ampm === "AM" && hh === 12) hh = 0;
      const time24 = `${hh.toString().padStart(2, "0")}:${minute}`;
      
      const datetime = new Date(`${date}T${time24}`).toISOString();
      
      const reminderData = {
        userId: user.uid,
        patientId,
        title,
        type,
        date,
        time: time24,
        datetime,
        repeat,
        sound,
        isDismissed: false,
      };

      if (editingId) {
        await updateDoc(doc(db, "reminders", editingId), reminderData);
      } else {
        await addDoc(collection(db, "reminders"), {
          ...reminderData,
          createdAt: serverTimestamp()
        });
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Failed to save reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setType("medicine");
    setDate("");
    setHour("12");
    setMinute("00");
    setAmpm("AM");
    setRepeat("none");
    setSound("beep");
  };

  const populateTime = (timeStr: string) => {
    if (!timeStr) return;
    const [h, m] = timeStr.split(":");
    let hh = parseInt(h, 10);
    setAmpm(hh >= 12 ? "PM" : "AM");
    hh = hh % 12;
    if (hh === 0) hh = 12;
    setHour(hh.toString().padStart(2, "0"));
    setMinute(m);
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setTitle(r.title);
    setPatientId(r.patientId || patients[0]?.id);
    setType(r.type || "medicine");
    setDate(r.date);
    populateTime(r.time);
    setRepeat(r.repeat || "none");
    setSound(r.sound || "beep");
    setIsModalOpen(true);
  };

  const handleDuplicate = (r: any) => {
    setEditingId(null);
    setTitle(`${r.title} (Copy)`);
    setPatientId(r.patientId || patients[0]?.id);
    setType(r.type || "medicine");
    setDate(r.date);
    populateTime(r.time);
    setRepeat(r.repeat || "none");
    setSound(r.sound || "beep");
    setIsModalOpen(true);
  };

  const formatTime12Hour = (time24: string) => {
    if (!time24) return "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "reminders", id));
    } catch(err) {
      console.error(err);
    }
  };

  const handleSnooze = async (r: any) => {
    try {
      const dt = new Date(r.datetime);
      dt.setMinutes(dt.getMinutes() + 15);
      
      const newTimeStr = `${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
      const newDateStr = dt.toISOString().split('T')[0];
      
      await updateDoc(doc(db, "reminders", r.id), {
        datetime: dt.toISOString(),
        time: newTimeStr,
        date: newDateStr,
        isDismissed: false
      });
      alert("Reminder snoozed for 15 minutes");
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareReminder = async (r: any) => {
    try {
      const patient = patients.find(p => p.id === r.patientId)?.name || "Family Member";
      const shareText = `Reminder for ${patient}: ${r.title}\nWhen: ${r.date} at ${formatTime12Hour(r.time)}`;
      
      if (navigator.share) {
        await navigator.share({
          title: 'I M Smrti Reminder',
          text: shareText
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("Reminder copied to clipboard! Share it with your family.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForType = (t: string) => {
    switch(t) {
      case 'medicine': return <Pill size={20} className="text-rose-500" />;
      case 'appointment': return <CalendarDays size={20} className="text-indigo-500" />;
      default: return <Bell size={20} className="text-amber-500" />;
    }
  };

  const getBgForType = (t: string) => {
    switch(t) {
      case 'medicine': return "bg-rose-100";
      case 'appointment': return "bg-indigo-100";
      default: return "bg-amber-100";
    }
  };

  const now = new Date();
  const upcoming = reminders.filter(r => new Date(r.datetime) >= now && !r.isDismissed);
  const past = reminders.filter(r => new Date(r.datetime) < now || r.isDismissed);

  return (
    <div className="pb-6 w-full max-w-lg mx-auto space-y-6 relative px-4">
      <div className="fixed top-0 left-0 right-0 h-[50vh] soft-gradient-bg -z-10 pointer-events-none"></div>
      
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bell className="text-primary" /> {t("missed.remindersTitle", "Reminders")}
        </h1>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-primary/90 transition-colors min-h-[44px]"
        >
          <Plus size={16} /> {t("missed.new", "New")}
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">{t("missed.upcoming", "Upcoming")}</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md rounded-[1.5rem] p-6 text-center border border-white/60">
            <Bell size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No upcoming reminders</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((r: any) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                  <div className={`size-12 rounded-full ${getBgForType(r.type)} flex items-center justify-center shrink-0`}>
                    {getIconForType(r.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-slate-800 truncate">{r.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><CalendarDays size={14} /> {r.date}</span>
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatTime12Hour(r.time)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end border-t border-slate-50 sm:border-t-0 pt-2 sm:pt-0">
                  <button onClick={() => handleShareReminder(r)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors" title="Share with Family">
                    <Share2 size={16} />
                  </button>
                  <button onClick={() => handleSnooze(r)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-full transition-colors" title="Snooze 15 min">
                    <Clock size={16} />
                  </button>
                  <button onClick={() => handleEdit(r)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors" title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDuplicate(r)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-full transition-colors" title="Duplicate">
                    <Copy size={16} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="space-y-4 mt-8 opacity-70">
          <h2 className="text-lg font-bold text-slate-800">Past & Dismissed</h2>
          <div className="grid gap-3">
            {past.map((r: any) => (
              <div key={r.id} className="bg-white/50 rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                  <div className={`size-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 grayscale opacity-50`}>
                    {getIconForType(r.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-slate-600 line-through truncate">{r.title}</h3>
                    <div className="text-xs text-slate-400 mt-1">{r.date} at {formatTime12Hour(r.time)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end border-t border-slate-50 sm:border-t-0 pt-2 sm:pt-0">
                  <button onClick={() => handleShareReminder(r)} className="p-2 text-slate-400 hover:text-blue-500 rounded-full">
                    <Share2 size={16} />
                  </button>
                  <button onClick={() => handleDuplicate(r)} className="p-2 text-slate-400 hover:text-emerald-500 rounded-full">
                    <Copy size={16} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-400 hover:text-rose-500 rounded-full">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="relative bg-white rounded-t-[2.5rem] px-6 pt-4 pb-8 shadow-2xl"
              style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{editingId ? "Edit Reminder" : "New Reminder"}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 text-slate-600 rounded-full"><X size={20}/></button>
              </div>

              <form onSubmit={handleAddReminder} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title</label>
                  <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Take Paracetamol" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium" />
                </div>
                
                {patients.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">For Who?</label>
                    <select value={patientId} onChange={e => setPatientId(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium appearance-none">
                      {patients.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'medicine', icon: Pill, label: 'Medicine' },
                      { id: 'appointment', icon: CalendarDays, label: 'Doctor' },
                      { id: 'other', icon: Activity, label: 'Other' },
                    ].map(t => (
                      <button type="button" key={t.id} onClick={() => setType(t.id)} className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all ${type === t.id ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 bg-white text-slate-500'}`}>
                        <t.icon size={20} />
                        <span className="text-xs font-bold">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Time</label>
                    <div className="flex gap-2">
                      <select value={hour} onChange={e => setHour(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-3 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium appearance-none text-center">
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="flex items-center text-slate-400 font-bold">:</span>
                      <select value={minute} onChange={e => setMinute(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-3 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium appearance-none text-center">
                        {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select value={ampm} onChange={e => setAmpm(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-3 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium appearance-none text-center">
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Repeat size={14}/> Repeat</label>
                    <select value={repeat} onChange={e => setRepeat(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium appearance-none">
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Volume2 size={14}/> Sound</label>
                    <select value={sound} onChange={e => setSound(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium appearance-none">
                      <option value="beep">Beep</option>
                      <option value="radar">Radar</option>
                      <option value="siren">Siren</option>
                      <option value="chime">Chime</option>
                    </select>
                  </div>
                </div>

                <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/25 mt-4 disabled:opacity-50">
                  {isSubmitting ? "Saving..." : "Save Reminder"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
