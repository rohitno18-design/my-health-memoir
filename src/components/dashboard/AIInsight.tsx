// AIInsight component
import { Bot, Sparkles, AlertCircle } from "lucide-react";

interface AIInsightProps {
  type: "Tip" | "Alert" | "Checkup";
  content: string;
  onAction?: () => void;
}

export function AIInsight({ type, content, onAction }: AIInsightProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-violet-50 rounded-lg">
             <Bot size={16} className="text-violet-600" />
           </div>
           <h3 className="font-bold text-slate-800 text-[13px]">AI Proactive Guard</h3>
        </div>
        <div className="flex items-center gap-1 bg-violet-100 px-2 py-0.5 rounded-full">
          <Sparkles size={8} className="text-violet-600 animate-pulse" />
          <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">{type}</span>
        </div>
      </div>

      <div className="flex-1 bg-violet-50/30 rounded-2xl p-4 border border-violet-100/50 mb-3 hover:bg-violet-50/50 transition-all cursor-pointer group" onClick={onAction}>
        <p className="text-[14px] font-bold text-slate-800 leading-relaxed">
          {content}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <button className="text-[11px] font-extrabold text-violet-700 hover:underline uppercase tracking-widest" onClick={onAction}>
          View Full Audit
        </button>
        <div className="size-8 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
          <AlertCircle size={16} />
        </div>
      </div>
    </div>
  );
}
