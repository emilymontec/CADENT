import type { Octokit } from "@octokit/rest";
import { withRetry } from "@/lib/github/client";

export interface CollectedRepository {
  githubId: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
}

/**
 * Trae los repositorios del usuario autenticado, paginando hasta agotar
 * resultados. ⚠️ Alcance MVP (sección 5): se filtran los privados — el
 * scope OAuth solicitado (public_repo) ni siquiera los devolvería, pero
 * filtramos explícitamente para dejar el contrato claro en el código.
 */
export async function getRepositories(client: Octokit): Promise<CollectedRepository[]> {
  const repos: CollectedRepository[] = [];
  let page = 1;
  const perPage = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await withRetry(() =>
      client.rest.repos.listForAuthenticatedUser({
        per_page: perPage,
        page,
        sort: "updated",
        affiliation: "owner,collaborator,organization_member"
      })
    );

    for (const repo of data) {
      if (repo.private) continue; // MVP: solo públicos (sección 5)
      repos.push({
        githubId: String(repo.id),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private ?? false,
        url: repo.html_url
      });
    }

    if (data.length < perPage) break;
    page += 1;
  }

  return repos;
}
