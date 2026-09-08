import type { AnalyticsCommitInput, AnalyticsPeriod } from "@/lib/analytics/types";
import { toLocalDateParts } from "@/lib/analytics/timezone";

export interface CommitStats {
  totalCommits: number;
  averageCommitsPerDay: number;
  averageCommitsPerWeek: number;
  averageCommitsPerMonth: number;
  activeDays: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateCommitStats(
  commits: AnalyticsCommitInput[],
  timezone: string,
  period: AnalyticsPeriod
): CommitStats {
  const totalCommits = commits.length;

  // "Día activo" = día calendario local con al menos un commit (sección 14.4:
  // normalizado a la timezone del usuario, no a UTC).
  const activeDays = new Set(commits.map((c) => toLocalDateParts(c.date, timezone).dateKey)).size;

  const periodDays = Math.max(1, Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000));

  return {
    totalCommits,
    averageCommitsPerDay: round2(totalCommits / periodDays),
    averageCommitsPerWeek: round2(totalCommits / (periodDays / 7)),
    averageCommitsPerMonth: round2(totalCommits / (periodDays / 30)),
    activeDays
  };
}
