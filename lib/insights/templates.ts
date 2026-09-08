import type { DetectedInsight } from "@/lib/insights/types";

/**
 * Plantillas deterministas (sección 16: fallback obligatorio cuando la IA
 * falla, está desactivada, o el usuario está en un plan/región sin
 * acceso a IA). Nunca deben fallar ni lanzar — si un campo de `data` no
 * está, se usa un valor por defecto razonable en vez de reventar.
 *
 * ⚠️ Solo español por ahora. La Fase 9 (i18n) es la que introduce
 * selección de idioma; este módulo ya está aislado del resto del engine
 * para que agregar locales ahí sea un cambio contenido a este archivo.
 */

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

type TemplateFn = (data: DetectedInsight["data"]) => string;

const TEMPLATES: Record<DetectedInsight["type"], TemplateFn> = {
  night_owl: (data) =>
    `El ${asNumber(data.nightActivityPercentage)}% de tus commits ocurren de noche. Eres un night owl del código.`,

  early_bird: (data) =>
    `Cerca del ${asNumber(data.earlyPercentage)}% de tu actividad pasa entre las 5 y las 9 de la mañana. Programas antes que el resto del mundo se despierte.`,

  weekend_warrior: (data) =>
    `El ${asNumber(data.weekendActivityPercentage)}% de tus commits fueron en fin de semana. El código no descansa, ni tú tampoco.`,

  consistent_committer: (data) =>
    `Tuviste actividad en el ${asNumber(data.activeDayRatio)}% de los días del período. Consistencia por encima de rachas explosivas.`,

  language_loyalist: (data) =>
    `${asString(data.language, "Tu lenguaje principal")} representa el ${asNumber(data.percentage)}% de tu código. Sabes lo que te gusta y no te desvías.`,

  polyglot: (data) =>
    `Programaste en ${asNumber(data.languageCount)} lenguajes distintos, sin que ninguno domine claramente. Un verdadero polyglot.`,

  mono_repo_focus: (data) =>
    `${Math.round(asNumber(data.percentage))}% de tus commits fueron en un solo repositorio: ${asString(data.repository, "tu proyecto principal")}. Enfoque total.`,

  serial_starter: (data) =>
    `Tocaste ${asNumber(data.activeRepositories)} repositorios distintos, con un promedio de solo ${asNumber(data.avgCommitsPerRepo)} commits cada uno. Te encanta empezar cosas nuevas.`,

  longest_streak: (data) =>
    `Tu racha más larga fue de ${asNumber(data.longestStreak)} días seguidos programando. Eso es disciplina.`,

  active_streak: (data) =>
    `Llevas ${asNumber(data.currentStreak)} días seguidos con actividad. La racha sigue viva.`
};

export function renderTemplate(insight: DetectedInsight): string {
  const template = TEMPLATES[insight.type];
  return template(insight.data);
}
