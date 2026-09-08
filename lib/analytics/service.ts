import { prisma } from "@/lib/db/prisma";
import { runAnalytics, type AnalyticsResult } from "@/lib/analytics/engine";
import { resolvePeriod, type PeriodOption } from "@/lib/dashboard/period";

/**
 * Capa de acceso a datos "delgada" (sección 13): trae de Prisma y delega
 * el cálculo al Analytics Engine puro. Se extrajo a un servicio
 * compartido para que el Server Component del dashboard (render inicial)
 * y `/api/analytics` (cambios de período desde el cliente) nunca
 * diverjan en cómo arman la consulta — antes esta lógica solo vivía en
 * el Route Handler y el dashboard no tenía forma de reutilizarla sin un
 * fetch interno a su propia API.
 */
export async function getAnalyticsForUser(
  userId: string,
  periodOption: PeriodOption
): Promise<AnalyticsResult> {
  const period = resolvePeriod(periodOption);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const [commits, repositories, languageStats] = await Promise.all([
    prisma.commit.findMany({
      where: { userId, date: { gte: period.start, lte: period.end } },
      select: { id: true, date: true, repositoryId: true }
    }),
    prisma.repository.findMany({
      where: { userId },
      select: { id: true, name: true }
    }),
    prisma.languageStat.findMany({
      where: { userId },
      select: { repositoryId: true, language: true, bytes: true, capturedAt: true }
    })
  ]);

  return runAnalytics({
    commits,
    repositories,
    languageStats,
    timezone: user.timezone,
    period
  });
}
