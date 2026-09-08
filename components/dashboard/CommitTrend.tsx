"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface DayBucket {
  date: string;
  count: number;
}

interface CommitTrendProps {
  dailyDistribution: DayBucket[];
}

/**
 * El trend agrupa por semana para que el gráfico sea legible en períodos
 * largos (rolling 12 meses = 365 puntos diarios sería ruido visual). El
 * agrupamiento es puramente de presentación (semanas de calendario, no
 * un cálculo de negocio) — los conteos diarios en sí ya vienen resueltos
 * del Analytics Engine, este componente solo los sum ariza para dibujar.
 */
export function CommitTrend({ dailyDistribution }: CommitTrendProps) {
  const weeklyData = useMemo(() => {
    if (dailyDistribution.length === 0) return [];

    const weeks: { label: string; commits: number }[] = [];
    for (let i = 0; i < dailyDistribution.length; i += 7) {
      const chunk = dailyDistribution.slice(i, i + 7);
      const total = chunk.reduce((sum, d) => sum + d.count, 0);
      weeks.push({ label: chunk[0].date.slice(5), commits: total });
    }
    return weeks;
  }, [dailyDistribution]);

  if (weeklyData.length === 0) {
    return <p className="text-sm text-neutral-500">Sin actividad en este período todavía.</p>;
  }

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="commitTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#58a6ff" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#58a6ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            axisLine={{ stroke: "#21262d" }}
            tickLine={false}
            interval={Math.ceil(weeklyData.length / 8)}
          />
          <Tooltip
            contentStyle={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 8,
              fontSize: 12
            }}
            labelFormatter={(label) => `Semana de ${label}`}
            formatter={(value: number) => [`${value} commits`, ""]}
          />
          <Area
            type="monotone"
            dataKey="commits"
            stroke="#58a6ff"
            strokeWidth={2}
            fill="url(#commitTrendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
