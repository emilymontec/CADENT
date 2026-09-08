import { inngest } from "@/lib/jobs/client";
import { prisma } from "@/lib/db/prisma";
import { createGitHubClient, getAuthenticatedUser, getVerifiedEmails } from "@/lib/github/client";
import { getRepositories } from "@/lib/github/repositories";
import { getCommitsForRepository } from "@/lib/github/commits";
import { getLanguagesForRepository } from "@/lib/github/languages";
import { createGitHubGraphQLClient, getContributionCalendar } from "@/lib/github/graphql";
import { resolvePeriod } from "@/lib/dashboard/period";

/**
 * Función de sincronización (sección 12) — se ejecuta en el runner de
 * Inngest, no en un Route Handler. `step.run` da checkpointing automático:
 * si un paso falla, Inngest reintenta solo ese paso, no todo el flujo.
 *
 * Route Handler (app/api/sync/route.ts) solo ENCOLA este evento; el
 * procesamiento real ocurre aquí.
 */
export const syncUserData = inngest.createFunction(
  { id: "sync-user-data", retries: 3 },
  { event: "sync/user.requested" },
  async ({ event, step }) => {
    const { userId, mode } = event.data;

    await step.run("mark-running", async () => {
      await prisma.syncState.update({
        where: { userId },
        data: { status: "RUNNING", progress: 0, errorMessage: null }
      });
    });

    const account = await step.run("load-github-account", async () => {
      return prisma.gitHubAccount.findUniqueOrThrow({ where: { userId } });
    });

    const client = createGitHubClient(account.accessToken);
    const graphqlClient = createGitHubGraphQLClient(account.accessToken);

    const githubUser = await step.run("fetch-github-user", () => getAuthenticatedUser(client));
    const verifiedEmails = await step.run("fetch-verified-emails", () =>
      getVerifiedEmails(client)
    );

    const repos = await step.run("fetch-repositories", () => getRepositories(client));

    await step.run("upsert-repositories", async () => {
      for (const repo of repos) {
        await prisma.repository.upsert({
          where: { githubId: repo.githubId },
          create: { ...repo, userId },
          update: { ...repo }
        });
      }
    });

    await step.run("update-progress-25", () =>
      prisma.syncState.update({ where: { userId }, data: { progress: 25 } })
    );

    // Commits + Languages por repo. Cada repo es su propio step para que un
    // fallo puntual (p. ej. un repo renombrado) no tire toda la sync.
    const totalRepos = repos.length || 1;
    for (const [index, repo] of repos.entries()) {
      const [owner, repoName] = repo.fullName.split("/");

      await step.run(`sync-repo-${repo.githubId}`, async () => {
        const dbRepo = await prisma.repository.findUniqueOrThrow({
          where: { githubId: repo.githubId }
        });

        const since =
          mode === "incremental"
            ? (await prisma.syncState.findUnique({ where: { userId } }))?.lastSyncedAt ?? undefined
            : undefined;

        const commits = await getCommitsForRepository(client, {
          owner,
          repo: repoName,
          since,
          verifiedEmails
        });

        for (const commit of commits) {
          await prisma.commit.upsert({
            where: { repositoryId_sha: { repositoryId: dbRepo.id, sha: commit.sha } },
            create: {
              sha: commit.sha,
              message: commit.message,
              date: new Date(commit.date),
              author: commit.author,
              authorEmail: commit.authorEmail,
              repositoryId: dbRepo.id,
              userId
            },
            update: {}
          });
        }

        const languages = await getLanguagesForRepository(client, { owner, repo: repoName });
        for (const lang of languages) {
          await prisma.languageStat.create({
            data: {
              language: lang.language,
              bytes: lang.bytes,
              percentage: lang.percentage,
              repositoryId: dbRepo.id,
              userId
            }
          });
        }
      });

      await step.run(`progress-${repo.githubId}`, () =>
        prisma.syncState.update({
          where: { userId },
          data: { progress: 25 + Math.round(((index + 1) / totalRepos) * 65) }
        })
      );
    }

    // Contribution calendar — obligatoriamente vía GraphQL (sección 6).
    await step.run("fetch-contribution-calendar", async () => {
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(now.getFullYear() - 1);

      const calendar = await getContributionCalendar(graphqlClient, {
        login: githubUser.login,
        from: oneYearAgo,
        to: now
      });

      // El calendario en sí se recalcula bajo demanda desde Commit en el
      // Analytics Engine; aquí solo lo usamos como validación cruzada /
      // fuente para actividad en repos que el usuario no posee directamente
      // (forks, orgs) que las llamadas REST por repo no cubren.
      return calendar.totalContributions;
    });

    await step.run("mark-completed", async () => {
      await prisma.syncState.update({
        where: { userId },
        data: { status: "COMPLETED", progress: 100, lastSyncedAt: new Date() }
      });
    });

    // Encola la generación de insights (Fase 1) para el período canónico
    // "rolling12" — la misma función que usa lib/insights/service.ts para
    // servirlos, así ambos calculan exactamente el mismo periodStart/
    // periodEnd (ver comentarios en lib/dashboard/period.ts sobre por qué
    // el truncado a día UTC importa aquí). Es un evento separado, no una
    // llamada directa, para que un fallo en insights nunca marque la
    // sincronización de datos como fallida.
    await step.sendEvent("trigger-insights-generation", {
      name: "insights/generate.requested",
      data: {
        userId,
        ...(() => {
          const period = resolvePeriod("rolling12");
          return { periodStart: period.start.toISOString(), periodEnd: period.end.toISOString() };
        })()
      }
    });
  }
);
