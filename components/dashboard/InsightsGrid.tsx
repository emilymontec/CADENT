import type { PersistedInsight } from "@/lib/insights/types";

// Etiqueta corta por tipo — solo para el encabezado de la tarjeta, el
// texto real es siempre `insight.narrative` (ya redactado por el
// Insights Engine). Este componente nunca decide qué dice un insight,
// solo cómo se presenta.
const TYPE_LABELS: Record<string, string> = {
  night_owl: "Night owl",
  early_bird: "Early bird",
  weekend_warrior: "Weekend warrior",
  consistent_committer: "Consistencia",
  language_loyalist: "Lenguaje favorito",
  polyglot: "Polyglot",
  mono_repo_focus: "Enfoque total",
  serial_starter: "Serial starter",
  longest_streak: "Racha récord",
  active_streak: "Racha activa"
};

interface InsightsGridProps {
  insights: PersistedInsight[];
}

export function InsightsGrid({ insights }: InsightsGridProps) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Todavía no hay suficientes datos para generar insights de este período.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="rounded-xl border border-wrapped-border bg-wrapped-card p-5"
        >
          <p className="text-[15px] leading-relaxed text-neutral-200">{insight.narrative}</p>
          <p className="mt-3 text-xs text-neutral-500">{TYPE_LABELS[insight.type] ?? insight.type}</p>
        </div>
      ))}
    </div>
  );
}
