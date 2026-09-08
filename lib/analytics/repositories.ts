import type { AnalyticsCommitInput, AnalyticsRepositoryInput } from "@/lib/analytics/types";

export interface RepositoryDistributionEntry {
  repositoryId: string;
  name: string;
  commitCount: number;
  percentage: number;
}

export interface RepositoryStats {
  totalRepositories: number;
  activeRepositories: number;
  topRepository: string | null;
  repositoryDistribution: RepositoryDistributionEntry[];
}

export function calculateRepositoryStats(
  commits: AnalyticsCommitInput[],
  repositories: AnalyticsRepositoryInput[]
): RepositoryStats {
  const nameById = new Map(repositories.map((r) => [r.id, r.name]));
  const countByRepo = new Map<string, number>();

  for (const commit of commits) {
    countByRepo.set(commit.repositoryId, (countByRepo.get(commit.repositoryId) ?? 0) + 1);
  }

  const totalCommits = commits.length;
  const repositoryDistribution: RepositoryDistributionEntry[] = Array.from(countByRepo.entries())
    .map(([repositoryId, commitCount]) => ({
      repositoryId,
      name: nameById.get(repositoryId) ?? repositoryId,
      commitCount,
      percentage: totalCommits > 0 ? Math.round((commitCount / totalCommits) * 10000) / 100 : 0
    }))
    .sort((a, b) => b.commitCount - a.commitCount);

  return {
    totalRepositories: repositories.length,
    activeRepositories: countByRepo.size,
    topRepository: repositoryDistribution[0]?.name ?? null,
    repositoryDistribution
  };
}
