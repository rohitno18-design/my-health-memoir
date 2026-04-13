import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Activity, Heart, Droplets, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  // Safe ID: no spaces, no special chars
  const gradientId = `vq-grad-${type.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="flex flex-col h-full overflow-hidden group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}18`, color: color }}>
            <Icon size={14} />
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t(`vitals.${tType}`)}</span>
        </div>
        {/* Compact trend pill - never clips */}
        <div
          className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"
          style={{
            backgroundColor: trend === "up" ? "#fef2f2" : trend === "down" ? "#f0fdf4" : `${color}15`,
            color: trend === "up" ? "#ef4444" : trend === "down" ? "#22c55e" : color,
          }}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "●"}
        </div>
      </div>

      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-black text-slate-900 tracking-tighter">{value}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>

      {/* Chart area: bleeds to edges for immersive look */}
      <div className="flex-1 min-h-[60px] -mx-6 -mb-6 relative mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                {/* Top: 30% opacity of the chart color (vivid tint, not gray) */}
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
