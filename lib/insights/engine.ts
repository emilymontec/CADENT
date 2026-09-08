import { detectAll } from "@/lib/insights/rules";
import { rankInsights } from "@/lib/insights/rank";
import { narrateInsight } from "@/lib/insights/narrate";
import type { GeneratedInsight, InsightDetectionInput } from "@/lib/insights/types";

export interface GenerateInsightsOptions {
  userId: string;
  useAI: boolean;
  maxInsights?: number;
}

/**
 * Insights Engine (sección 16 del roadmap de producto).
 *
 * Pipeline: `detectAll` (Analytics Engine → patrones estructurados) →
 * `rankInsights` (prioridad + exclusión mutua) → `narrateInsight`
 * (lenguaje natural, IA o plantilla). Cada etapa es reemplazable e
 * independiente — se puede testear detección sin narrar, o narrar con un
 * insight de fixture sin pasar por el Analytics Engine.
 */
export async function generateInsights(
  input: InsightDetectionInput,
  options: GenerateInsightsOptions
): Promise<GeneratedInsight[]> {
  const detected = detectAll(input);
  const ranked = rankInsights(detected, options.maxInsights ?? 6);

  const results: GeneratedInsight[] = [];
  for (const insight of ranked) {
    const { text, source } = await narrateInsight(insight, {
      userId: options.userId,
      useAI: options.useAI
    });
    results.push({ ...insight, narrative: text, source });
  }

  return results;
}

export * from "@/lib/insights/types";
