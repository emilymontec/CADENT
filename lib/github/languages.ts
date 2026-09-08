import type { Octokit } from "@octokit/rest";
import { withRetry } from "@/lib/github/client";

export interface LanguageBreakdown {
  language: string;
  bytes: number;
  percentage: number;
}

/**
 * GET /repos/{owner}/{repo}/languages devuelve bytes por lenguaje.
 * Cada llamada representa un snapshot — se persiste con `capturedAt` en
 * LanguageStat (serie de tiempo, ver prisma/schema.prisma) para poder
 * reconstruir "Language Evolution" (sección 26) más adelante.
 */
export async function getLanguagesForRepository(
  client: Octokit,
  params: { owner: string; repo: string }
): Promise<LanguageBreakdown[]> {
  const { data } = await withRetry(() =>
    client.rest.repos.listLanguages({ owner: params.owner, repo: params.repo })
  );

  const totalBytes = Object.values(data).reduce((sum, b) => sum + (b ?? 0), 0);
  if (totalBytes === 0) return [];

  return Object.entries(data).map(([language, bytes]) => ({
    language,
    bytes: bytes ?? 0,
    percentage: Math.round(((bytes ?? 0) / totalBytes) * 10000) / 100
  }));
}
