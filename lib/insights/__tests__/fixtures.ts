import type { AnalyticsResult } from "@/lib/analytics/engine";

/**
 * Construye un AnalyticsResult completo con defaults "neutros" (nada
 * dispara ningún insight), para que cada test solo sobreescriba el campo
 * que le interesa probar — evita que los tests se rompan cada vez que se
 * agrega un campo nuevo al Analytics Engine.
 */
export function buildAnalyticsFixture(overrides: Partial<AnalyticsResult> = {}): AnalyticsResult {
  const base: AnalyticsResult = {
    commitStats: {
      totalCommits: 0,
      averageCommitsPerDay: 0,
      averageCommitsPerWeek: 0,
      averageCommitsPerMonth: 0,
      activeDays: 0
    },
    repositoryStats: {
      totalRepositories: 1,
      activeRepositories: 1,
      topRepository: "repo-1",
      repositoryDistribution: [
        { repositoryId: "repo-1", name: "repo-1", commitCount: 0, percentage: 100 }
      ]
    },
    languageStats: {
      topLanguage: "TypeScript",
      distribution: [{ language: "TypeScript", totalBytes: 1000, percentage: 100 }],
      languageCount: 1,
      languageDiversity: 0
    },
    temporal: {
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
      weekdayDistribution: [
        { weekday: "Monday", count: 0 },
        { weekday: "Tuesday", count: 0 },
        { weekday: "Wednesday", count: 0 },
        { weekday: "Thursday", count: 0 },
        { weekday: "Friday", count: 0 },
        { weekday: "Saturday", count: 0 },
        { weekday: "Sunday", count: 0 }
      ],
      dailyDistribution: [],
      mostActiveHour: null,
      mostActiveDay: null,
      nightActivityPercentage: 0,
      weekendActivityPercentage: 0
    },
    streaks: { currentStreak: 0, longestStreak: 0, streakStart: null, streakEnd: null }
  };

  return {
    ...base,
    ...overrides,
    commitStats: { ...base.commitStats, ...overrides.commitStats },
    repositoryStats: { ...base.repositoryStats, ...overrides.repositoryStats },
    languageStats: { ...base.languageStats, ...overrides.languageStats },
    temporal: { ...base.temporal, ...overrides.temporal },
    streaks: { ...base.streaks, ...overrides.streaks }
  };
}
