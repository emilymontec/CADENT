import { prisma } from "@/lib/db/prisma";
import { resolvePeriod } from "@/lib/dashboard/period";

/**
 * ⚠️ Decisión de producto: los insights siempre corresponden al período
 * canónico "rolling12" ("tu año"), sin importar qué período tenga
 * seleccionado el selector de gráficos del dashboard. Generarlos para
 * cada uno de los 3 períodos posibles (last30/calendarYear/rolling12)
 * multiplicaría por 3 el costo de IA sin aportar valor narrativo real —
 * un insight tipo "night owl" no necesita recalcularse para "últimos 30
 * días" cada vez que alguien cambia el selector de gráficos.
 *
 * Igual que lib/analytics/service.ts: solo lee lo que el job de Inngest
 * (lib/jobs/insights.ts) ya generó y persistió. Nunca genera insights al
 * vuelo — eso reintroduciría llamadas a IA dentro de una request HTTP,
 * exactamente lo que el job queue evita (sección 32).
 *
 * ⚠️ Sin anotación de tipo de retorno explícita a propósito: se infiere
 * de `prisma.insight.findMany(...)` (será `Insight[]` una vez corrido
 * `prisma generate` contra una DB real). Importar el tipo `Insight`
 * nombrado desde "@prisma/client" fallaría en cualquier entorno donde el
 * cliente no se haya generado todavía — mismo motivo por el que el resto
 * del código evita tipos de Prisma importados explícitamente.
 */
export async function getInsightsForUser(userId: string) {
  const period = resolvePeriod("rolling12");

  return prisma.insight.findMany({
    where: { userId, periodStart: period.start, periodEnd: period.end },
    orderBy: { priority: "desc" }
  });
}
