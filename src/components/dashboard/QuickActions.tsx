import { motion } from "framer-motion";
import { UploadCloud, Plus } from "lucide-react";

interface QuickActionsProps {
  onAddDocument: () => void;
  documentAnalysisEnabled?: boolean;
}

export function QuickActions({ onAddDocument, documentAnalysisEnabled = true }: QuickActionsProps) {

  return (
    <div className="flex flex-col h-full items-center justify-center gap-4 py-2">
      {documentAnalysisEnabled ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAddDocument}
          className="tour-upload-btn w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="p-2 bg-white/20 rounded-xl">
            <Plus size={20} strokeWidth={3} />
          </div>
          <span className="text-base tracking-wide">Add Document</span>
        </motion.button>
      ) : (
        <div className="w-full h-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 opacity-60">
          <UploadCloud size={20} />
          <span>Add Document</span>
        </div>
      )}
    </div>
  );
}
