import { motion } from "framer-motion";
import { UploadCloud, Camera, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface QuickActionsProps {
  onUpload: () => void;
  onCamera: () => void;
}

export function QuickActions({ onUpload, onCamera }: QuickActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full items-center justify-center gap-4 py-2">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onUpload}
        className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        <div className="p-1.5 bg-white/20 rounded-lg">
          <UploadCloud size={18} />
        </div>
        <span>{t("dashboard.uploadBtn")}</span>
        <Plus size={14} className="opacity-50" />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.8)" }}
        whileTap={{ scale: 0.98 }}
        onClick={onCamera}
        className="w-full h-14 bg-white/40 backdrop-blur-md border border-white text-slate-800 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-3 active:bg-white/60 transition-all group"
      >
        <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <Camera size={18} />
        </div>
        <span>{t("dashboard.docScan")}</span>
      </motion.button>
    </div>
  );
}
