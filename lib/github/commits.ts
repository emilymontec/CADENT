import type { Octokit } from "@octokit/rest";
import { withRetry } from "@/lib/github/client";

export interface CollectedCommit {
  sha: string;
  message: string;
  date: string; // ISO, UTC — la normalización de timezone ocurre en Analytics Engine
  author: string;
  authorEmail: string | null;
  isOwnedByUser: boolean;
}

/**
 * Trae commits de un repo, paginando. `since` habilita incremental sync
 * (sección 12): solo se piden commits posteriores a la última sincronización.
 *
 * ⚠️ Resolución de identidad (sección 11): un commit puede no estar
 * vinculado automáticamente a la cuenta de GitHub del usuario si el email
 * del commit local no coincide con ninguno registrado en la cuenta. Por
 * eso comparamos también contra `verifiedEmails`, no solo contra
 * `commit.author.login`.
 */
export async function getCommitsForRepository(
  client: Octokit,
  params: { owner: string; repo: string; since?: Date; verifiedEmails: string[] }
): Promise<CollectedCommit[]> {
  const { owner, repo, since, verifiedEmails } = params;
  const emailSet = new Set(verifiedEmails.map((e) => e.toLowerCase()));
  const commits: CollectedCommit[] = [];
  let page = 1;
  const perPage = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await withRetry(() =>
      client.rest.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page,
        since: since?.toISOString()
      })
    );

    for (const commit of data) {
      const commitAuthorEmail = commit.commit.author?.email ?? null;
      const isOwnedByUser =
        Boolean(commit.author?.login) || // GitHub ya lo vinculó
        (commitAuthorEmail !== null && emailSet.has(commitAuthorEmail.toLowerCase()));

      commits.push({
        sha: commit.sha,
        message: commit.commit.message,
        date: commit.commit.author?.date ?? commit.commit.committer?.date ?? new Date().toISOString(),
        author: commit.commit.author?.name ?? "unknown",
        authorEmail: commitAuthorEmail,
        isOwnedByUser
      });
    }

    if (data.length < perPage) break;
    page += 1;
  }

  return commits.filter((c) => c.isOwnedByUser);
}
