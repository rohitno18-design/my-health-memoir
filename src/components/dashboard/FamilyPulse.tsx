import { motion } from "framer-motion";
import { User, Users } from "lucide-react";
import type { Patient } from "@/pages/PatientsPage";

interface FamilyPulseProps {
  patients: Patient[];
  onSelect: (patientId: string) => void;
}

export function FamilyPulse({ patients, onSelect }: FamilyPulseProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <div className="p-2 bg-emerald-50 rounded-lg">
             <Users size={18} className="text-emerald-600" />
           </div>
           <h3 className="font-bold text-slate-800 text-sm">Family Pulse</h3>
        </div>
        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">All Stable</span>
      </div>

      <div className="flex -space-x-3 overflow-visible mb-6 h-12 items-center">
        {patients.length === 0 ? (
          <div className="w-full flex items-center justify-center text-slate-400 text-xs italic">
            No family members added.
          </div>
        ) : (
          patients.slice(0, 4).map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onSelect(p.id)}
              className="relative group border-2 border-white rounded-2xl bg-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <div className="size-12 rounded-[14px] overflow-hidden bg-slate-100 flex items-center justify-center">
                {p.photoURL ? (
                  <img src={p.photoURL} alt={p.name} className="size-full object-cover" />
                ) : (
                  <User size={20} className="text-slate-400" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {p.name}
              </div>
            </motion.button>
          ))
        )}
        {patients.length > 4 && (
          <div className="size-12 rounded-2xl bg-slate-50 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-400">
            +{patients.length - 4}
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100/50">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <span>Next Checkup</span>
          <span className="text-slate-600">Apr 12 - Mom</span>
        </div>
      </div>
    </div>
  );
}
