import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Activity, Heart, Droplets, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface VitalsQuickViewProps {
  type: "BP" | "Sugar" | "Pulse" | "Heart Rate" | "Weight";
  value: string | number;
  unit: string;
  trend: "up" | "down" | "stable";
  data: { date: string; value: number }[];
  color: string;
}

export function VitalsQuickView({ type, value, unit, trend, data, color }: VitalsQuickViewProps) {
  const { t } = useTranslation();
  const Icon = type === "BP" ? Activity : type === "Sugar" ? Droplets : type === "Heart Rate" ? Heart : type === "Weight" ? Scale : Heart;
  const tType = type === "BP" ? "bp" : type === "Sugar" ? "sugar" : type === "Heart Rate" ? "heartRate" : type === "Weight" ? "weight" : "heartRate";

  return (
    <div className="flex flex-col h-full overflow-hidden group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15`, color: color }}>
            <Icon size={14} />
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t(`vitals.${tType}`)}</span>
        </div>
        <div className={`text-[10px] font-black uppercase tracking-tighter ${trend === 'up' ? 'text-rose-50' : trend === 'down' ? 'text-emerald-50' : 'text-slate-400'}`}>
          <div className={cn("px-2 py-0.5 rounded-md flex items-center gap-1", trend === 'up' ? 'bg-rose-500' : trend === 'down' ? 'bg-emerald-500' : 'bg-slate-100')}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'} {t(`vitals.${trend}`)}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-black text-slate-900 tracking-tighter">{value}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>

      <div className="flex-1 min-h-[60px] -mx-6 -mb-6 relative mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${type})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
