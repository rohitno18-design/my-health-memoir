import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Activity, Heart, Droplet } from "lucide-react";

interface VitalsQuickViewProps {
  type: "BP" | "Sugar" | "Pulse";
  value: string | number;
  unit: string;
  trend: "up" | "down" | "stable";
  data: { date: string; value: number }[];
  color: string;
}

export function VitalsQuickView({ type, value, unit, trend, data, color }: VitalsQuickViewProps) {
  const Icon = type === "BP" ? Activity : type === "Sugar" ? Droplet : Heart;

  return (
    <div className="flex flex-col h-full overflow-hidden group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15`, color: color }}>
            <Icon size={14} />
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{type}</span>
        </div>
        <div className={`text-[10px] font-black uppercase tracking-tighter ${trend === 'up' ? 'text-rose-500' : trend === 'down' ? 'text-emerald-500' : 'text-slate-400'}`}>
          {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'} {trend}
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
