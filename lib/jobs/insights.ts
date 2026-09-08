import { inngest } from "@/lib/jobs/client";
import { prisma } from "@/lib/db/prisma";
import { runAnalytics } from "@/lib/analytics/engine";
import { generateInsights } from "@/lib/insights/engine";

/**
 * Corre después de sync-user-data (encolado como evento separado desde
 * lib/jobs/sync.ts). Deliberadamente independiente: si la generación de
 * insights falla o la IA no responde, la sincronización de datos ya se
 * marcó como COMPLETED y el usuario ve sus datos igual — los insights son
 * una capa de presentación encima, no un requisito para tener datos.
 */
export const generateUserInsights = inngest.createFunction(
  { id: "generate-user-insights", retries: 2 },
  { event: "insights/generate.requested" },
  async ({ event, step }) => {
    const { userId, periodStart, periodEnd } = event.data;
    const period = { start: new Date(periodStart), end: new Date(periodEnd) };

    // Se proyecta explícitamente al campo que necesitamos: step.run
    // serializa su resultado entre pasos de Inngest, así que es mejor
    // devolver un shape mínimo y explícito que el objeto completo de
    // Prisma (evita además acoplar este job al tipo completo de User).
    const user = await step.run("load-user", async () => {
      const record = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return { timezone: record.timezone };
    });

    const [commits, repositories, languageStats] = await step.run("load-data", async () => {
      return Promise.all([
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
    });

    const generated = await step.run("run-engines", () => {
      const analytics = runAnalytics({
        commits,
        repositories,
        languageStats,
        timezone: user.timezone,
        period
      });

      const periodDays = Math.max(
        1,
        Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000)
      );

      return generateInsights(
        { analytics, periodDays },
        // useAI depende de que la API key esté configurada — sin ella,
        // el engine cae automáticamente a plantillas deterministas.
        { userId, useAI: Boolean(process.env.ANTHROPIC_API_KEY) }
      );
    });

    await step.run("persist-insights", async () => {
      for (const insight of generated) {
        await prisma.insight.upsert({
          where: {
            userId_periodStart_periodEnd_type: {
              userId,
              periodStart: period.start,
              periodEnd: period.end,
              type: insight.type
            }
          },
          create: {
            userId,
            periodStart: period.start,
            periodEnd: period.end,
            type: insight.type,
            priority: insight.priority,
            data: insight.data,
            narrative: insight.narrative,
            source: insight.source
          },
          update: {
            priority: insight.priority,
            data: insight.data,
            narrative: insight.narrative,
            source: insight.source
          }
        });
      }
    });

    return { insightsGenerated: generated.length };
  }
);
