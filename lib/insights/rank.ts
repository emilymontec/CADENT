import type { DetectedInsight, InsightType } from "@/lib/insights/types";

/**
 * Pares de insights que representan lo opuesto entre sí. En teoría los
 * umbrales de las reglas ya los hacen mutuamente excluyentes, pero se
 * resuelve explícitamente aquí para no depender de que los umbrales nunca
 * se toquen sin revisar esto también.
 */
const MUTUALLY_EXCLUSIVE_PAIRS: [InsightType, InsightType][] = [
  ["night_owl", "early_bird"],
  ["language_loyalist", "polyglot"],
  ["mono_repo_focus", "serial_starter"]
];

function resolveMutualExclusions(insights: DetectedInsight[]): DetectedInsight[] {
  const byType = new Map(insights.map((i) => [i.type, i]));

  for (const [typeA, typeB] of MUTUALLY_EXCLUSIVE_PAIRS) {
    const a = byType.get(typeA);
    const b = byType.get(typeB);
    if (a && b) {
      // Se queda el de mayor prioridad (mayor señal), se descarta el otro.
      if (a.priority >= b.priority) byType.delete(typeB);
      else byType.delete(typeA);
    }
  }

  return Array.from(byType.values());
}

export function rankInsights(insights: DetectedInsight[], maxInsights = 6): DetectedInsight[] {
  // Nota: se indexa por `type`, así que asume que `detectAll` nunca
  // produce dos insights del mismo tipo en una misma pasada (cada regla
  // corre una sola vez). Si en el futuro una regla pudiera emitir el
  // mismo tipo más de una vez, este dedup silencioso dejaría de ser
  // correcto y habría que revisarlo explícitamente.
  const resolved = resolveMutualExclusions(insights);
  return resolved.sort((a, b) => b.priority - a.priority).slice(0, maxInsights);
}
