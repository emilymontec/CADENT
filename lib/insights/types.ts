import type { AnalyticsResult } from "@/lib/analytics/engine";

/**
 * Catálogo cerrado de tipos de insight (sección 16 del roadmap de
 * producto). Cerrado a propósito: cada tipo nuevo requiere agregar una
 * regla de detección + una plantilla de fallback, nunca se inventan
 * tipos dinámicamente ni la IA elige el tipo — eso rompería el pipeline
 * "datos → Analytics Engine → métricas → Insights Engine → lenguaje
 * natural".
 */
export const INSIGHT_TYPES = [
  "night_owl",
  "early_bird",
  "weekend_warrior",
  "consistent_committer",
  "language_loyalist",
  "polyglot",
  "mono_repo_focus",
  "serial_starter",
  "longest_streak",
  "active_streak"
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];

/**
 * Salida de una regla de detección — puramente estructurada, sin texto.
 * `data` contiene exactamente los números que justifican el insight, para
 * que la narración (con o sin IA) no tenga que volver a tocar el
 * Analytics Engine.
 */
export interface DetectedInsight {
  type: InsightType;
  priority: number;
  data: Record<string, number | string | null>;
}

/**
 * Entrada común a todas las reglas de detección. `periodDays` no vive en
 * AnalyticsResult (el engine de analytics no conoce el concepto de
 * "duración del período" más que a través de sus promedios), así que se
 * pasa explícitamente en vez de forzar al Analytics Engine a exponerlo.
 */
export interface InsightDetectionInput {
  analytics: AnalyticsResult;
  periodDays: number;
}

export interface GeneratedInsight extends DetectedInsight {
  narrative: string;
  source: "TEMPLATE" | "AI";
}

/**
 * Forma de un Insight ya persistido en DB, tal como lo consume la UI del
 * dashboard. Se define aquí (en vez de importar el tipo `Insight` de
 * `@prisma/client`) porque ese import nombrado solo existe después de
 * correr `prisma generate` contra una DB real — este tipo es el
 * contrato estable que usan los componentes de UI independientemente de
 * si el cliente de Prisma está generado en el entorno actual.
 */
export interface PersistedInsight {
  id: string;
  type: string;
  priority: number;
  data: Record<string, unknown>;
  narrative: string;
  source: "TEMPLATE" | "AI";
}
