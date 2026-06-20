import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { BellRing, Check, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function GlobalAlarmListener() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<any | null>(null);
  
  // Audio Context for synthesizing loud alarm
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "reminders"), where("userId", "==", user.uid), where("isDismissed", "==", false));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReminders(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (reminders.length === 0) return;

    const checkAlarms = () => {
      if (activeAlarm) return; // Don't trigger if one is already ringing
      const now = new Date();
      for (const r of reminders) {
        if (!r.datetime) continue;
        let alarmTime = new Date(r.datetime);

        // Adjust for preReminder
        if (r.preReminder === "5m") alarmTime.setMinutes(alarmTime.getMinutes() - 5);
        else if (r.preReminder === "15m") alarmTime.setMinutes(alarmTime.getMinutes() - 15);
        else if (r.preReminder === "30m") alarmTime.setMinutes(alarmTime.getMinutes() - 30);
        else if (r.preReminder === "1h") alarmTime.setHours(alarmTime.getHours() - 1);

        // If alarm time is in the past, or within the next 30 seconds
        const diffMs = now.getTime() - alarmTime.getTime();
        // Trigger if it's past due (up to 2 hours ago) to avoid ancient alarms triggering
        if (diffMs > 0 && diffMs < 2 * 60 * 60 * 1000) {
          triggerAlarm(r);
          break;
        }
      }
    };

    // Check immediately, then every 10 seconds
    checkAlarms();
    const interval = setInterval(checkAlarms, 10000);
    return () => clearInterval(interval);
  }, [reminders, activeAlarm]);

  const playLoudAlarm = (soundType: string) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const playBeep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    };

    const playRadar = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.2);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    };

    const playSiren = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    };

    const playChime = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
      
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    };

    const triggerSound = () => {
      if (soundType === 'radar') playRadar();
      else if (soundType === 'siren') playSiren();
      else if (soundType === 'chime') playChime();
      else playBeep();
    };

    triggerSound();
    intervalRef.current = setInterval(triggerSound, soundType === 'chime' ? 2000 : 1000);
  };

  const stopAlarm = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch(e) {}
    }
  };

  const triggerAlarm = (reminder: any) => {
    setActiveAlarm(reminder);
    playLoudAlarm(reminder.sound || 'beep');
  };

  const handleDismiss = async () => {
    if (!activeAlarm) return;
    stopAlarm();
    try {
      if (activeAlarm.repeat && activeAlarm.repeat !== "none") {
        const nextDate = new Date(activeAlarm.datetime);
        if (activeAlarm.repeat === "daily") nextDate.setDate(nextDate.getDate() + 1);
        else if (activeAlarm.repeat === "weekly") nextDate.setDate(nextDate.getDate() + 7);
        else if (activeAlarm.repeat === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        else if (activeAlarm.repeat === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);
        
        // Also update the formatted 'date' string
        const pad = (n: number) => n.toString().padStart(2, '0');
        const newDateStr = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
        
        await updateDoc(doc(db, "reminders", activeAlarm.id), { 
          datetime: nextDate.toISOString(),
          date: newDateStr,
          isDismissed: false
        });
      } else {
        await updateDoc(doc(db, "reminders", activeAlarm.id), { isDismissed: true });
      }
    } catch(err) {
      console.error(err);
    }
    setActiveAlarm(null);
  };

  const handleSnooze = async () => {
    if (!activeAlarm) return;
    stopAlarm();
    try {
      // Add 10 minutes
      const snoozeTime = new Date(Date.now() + 10 * 60000).toISOString();
      await updateDoc(doc(db, "reminders", activeAlarm.id), { datetime: snoozeTime });
    } catch(err) {
      console.error(err);
    }
    setActiveAlarm(null);
  };

  return (
    <AnimatePresence>
      {activeAlarm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center text-center ring-4 ring-rose-500/20"
          >
            <motion.div 
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1, repeatDelay: 1 }}
              className="size-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-rose-200/50"
            >
              <BellRing size={40} />
            </motion.div>
            
            <h2 className="text-2xl font-black text-slate-800 mb-2">Reminder!</h2>
            <p className="text-slate-600 font-medium mb-6">{activeAlarm.title || "Health Reminder"}</p>
            
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={handleDismiss}
                className="w-full flex items-center justify-center gap-2 bg-rose-500 text-white font-bold py-4 rounded-2xl hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/20"
              >
                <Check size={20} />
                Acknowledge & Dismiss
              </button>
              <button 
                onClick={handleSnooze}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                <Clock size={20} />
                Snooze for 10 mins
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
