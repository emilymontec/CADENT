interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
}

export function StreakCard({ currentStreak, longestStreak }: StreakCardProps) {
  const isRecord = currentStreak > 0 && currentStreak >= longestStreak;

  return (
    <div className="flex items-center justify-between rounded-xl border border-wrapped-border bg-wrapped-card p-6">
      <div>
        <p className="font-display text-4xl font-semibold tabular-nums text-wrapped-amber">
          {currentStreak}
        </p>
        <p className="text-sm text-neutral-400">
          {currentStreak === 0 ? "Sin racha activa" : "días seguidos, ahora mismo"}
        </p>
      </div>
      <div className="h-10 w-px bg-wrapped-border" />
      <div className="text-right">
        <p className="font-display text-2xl font-semibold tabular-nums text-neutral-300">
          {longestStreak}
        </p>
        <p className="text-sm text-neutral-500">{isRecord ? "récord (¡es ahora!)" : "récord del período"}</p>
      </div>
    </div>
  );
}
