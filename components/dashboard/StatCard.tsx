interface StatCardProps {
  value: string | number;
  label: string;
  accent?: boolean;
}

export function StatCard({ value, label, accent = false }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`font-display text-4xl font-semibold tabular-nums ${
          accent ? "text-wrapped-accent" : "text-white"
        }`}
      >
        {value}
      </span>
      <span className="text-sm text-neutral-400">{label}</span>
    </div>
  );
}
