import { describe, expect, it } from "vitest";
import {
  detectActiveStreak,
  detectAll,
  detectConsistentCommitter,
  detectEarlyBird,
  detectLanguageLoyalist,
  detectLongestStreak,
  detectMonoRepoFocus,
  detectNightOwl,
  detectPolyglot,
  detectSerialStarter,
  detectWeekendWarrior
} from "@/lib/insights/rules";
import { buildAnalyticsFixture } from "@/lib/insights/__tests__/fixtures";

describe("detectNightOwl", () => {
  it("no dispara con pocos commits, incluso con 100% actividad nocturna", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 5, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 5 },
      temporal: { ...buildAnalyticsFixture().temporal, nightActivityPercentage: 100 }
    });
    expect(detectNightOwl({ analytics, periodDays: 30 })).toBeNull();
  });

  it("dispara con suficiente muestra y >=40% actividad nocturna", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      temporal: { ...buildAnalyticsFixture().temporal, nightActivityPercentage: 62 }
    });
    const result = detectNightOwl({ analytics, periodDays: 30 });
    expect(result?.type).toBe("night_owl");
    expect(result?.data.nightActivityPercentage).toBe(62);
  });

  it("no dispara justo debajo del umbral (39%)", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      temporal: { ...buildAnalyticsFixture().temporal, nightActivityPercentage: 39 }
    });
    expect(detectNightOwl({ analytics, periodDays: 30 })).toBeNull();
  });
});

describe("detectEarlyBird", () => {
  it("dispara cuando >=30% de la distribución horaria cae entre 5-9am", () => {
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    hourlyDistribution[6].count = 20;
    hourlyDistribution[7].count = 15;
    hourlyDistribution[14].count = 15; // resto del día

    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      temporal: { ...buildAnalyticsFixture().temporal, hourlyDistribution }
    });

    const result = detectEarlyBird({ analytics, periodDays: 30 });
    expect(result?.type).toBe("early_bird");
    expect(result?.data.earlyPercentage).toBe(70);
  });
});

describe("detectWeekendWarrior", () => {
  it("no dispara en el baseline esperado (~28.6%)", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      temporal: { ...buildAnalyticsFixture().temporal, weekendActivityPercentage: 28.6 }
    });
    expect(detectWeekendWarrior({ analytics, periodDays: 30 })).toBeNull();
  });

  it("dispara por encima del baseline (>=35%)", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      temporal: { ...buildAnalyticsFixture().temporal, weekendActivityPercentage: 45 }
    });
    expect(detectWeekendWarrior({ analytics, periodDays: 30 })?.type).toBe("weekend_warrior");
  });
});

describe("detectConsistentCommitter", () => {
  it("usa periodDays para calcular el ratio de días activos, no un valor fijo", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 40, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 }
    });

    // 20 días activos de 30 = 66.7% -> dispara
    expect(detectConsistentCommitter({ analytics, periodDays: 30 })?.type).toBe(
      "consistent_committer"
    );
    // 20 días activos de 100 = 20% -> no dispara
    expect(detectConsistentCommitter({ analytics, periodDays: 100 })).toBeNull();
  });
});

describe("detectLanguageLoyalist / detectPolyglot", () => {
  it("language_loyalist dispara con >=80% en un solo lenguaje", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      languageStats: {
        topLanguage: "Rust",
        distribution: [{ language: "Rust", totalBytes: 9000, percentage: 90 }],
        languageCount: 1,
        languageDiversity: 0
      }
    });
    expect(detectLanguageLoyalist({ analytics, periodDays: 30 })?.data.language).toBe("Rust");
  });

  it("polyglot dispara con 4+ lenguajes y diversidad alta", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      languageStats: {
        topLanguage: "TypeScript",
        distribution: [
          { language: "TypeScript", totalBytes: 300, percentage: 30 },
          { language: "Python", totalBytes: 280, percentage: 28 },
          { language: "Go", totalBytes: 220, percentage: 22 },
          { language: "Rust", totalBytes: 200, percentage: 20 }
        ],
        languageCount: 4,
        languageDiversity: 0.95
      }
    });
    expect(detectPolyglot({ analytics, periodDays: 30 })?.type).toBe("polyglot");
  });

  it("son mutuamente excluyentes por diseño de umbrales (nunca ambos a la vez)", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      languageStats: {
        topLanguage: "Rust",
        distribution: [{ language: "Rust", totalBytes: 9000, percentage: 90 }],
        languageCount: 1,
        languageDiversity: 0
      }
    });
    expect(detectLanguageLoyalist({ analytics, periodDays: 30 })).not.toBeNull();
    expect(detectPolyglot({ analytics, periodDays: 30 })).toBeNull();
  });
});

describe("detectMonoRepoFocus / detectSerialStarter", () => {
  it("mono_repo_focus requiere al menos 2 repos activos, no solo 1", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      repositoryStats: {
        totalRepositories: 1,
        activeRepositories: 1,
        topRepository: "solo-repo",
        repositoryDistribution: [
          { repositoryId: "r1", name: "solo-repo", commitCount: 50, percentage: 100 }
        ]
      }
    });
    // Un solo repo total no es "enfoque", es la única opción disponible.
    expect(detectMonoRepoFocus({ analytics, periodDays: 30 })).toBeNull();
  });

  it("mono_repo_focus dispara con 2+ repos y concentración >=70%", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 50, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 20 },
      repositoryStats: {
        totalRepositories: 3,
        activeRepositories: 2,
        topRepository: "main-repo",
        repositoryDistribution: [
          { repositoryId: "r1", name: "main-repo", commitCount: 40, percentage: 80 },
          { repositoryId: "r2", name: "side-repo", commitCount: 10, percentage: 20 }
        ]
      }
    });
    expect(detectMonoRepoFocus({ analytics, periodDays: 30 })?.data.repository).toBe("main-repo");
  });

  it("serial_starter dispara con 5+ repos activos y bajo promedio de commits por repo", () => {
    const analytics = buildAnalyticsFixture({
      commitStats: { totalCommits: 30, averageCommitsPerDay: 0, averageCommitsPerWeek: 0, averageCommitsPerMonth: 0, activeDays: 15 },
      repositoryStats: {
        totalRepositories: 8,
        activeRepositories: 8,
        topRepository: "repo-1",
        repositoryDistribution: []
      }
    });
    const result = detectSerialStarter({ analytics, periodDays: 30 });
    expect(result?.type).toBe("serial_starter");
    expect(result?.data.avgCommitsPerRepo).toBe(3.8);
  });
});

describe("detectLongestStreak / detectActiveStreak", () => {
  it("longest_streak requiere al menos 7 días", () => {
    const analytics = buildAnalyticsFixture({ streaks: { currentStreak: 2, longestStreak: 6, streakStart: "2026-01-01", streakEnd: "2026-01-06" } });
    expect(detectLongestStreak({ analytics, periodDays: 30 })).toBeNull();
  });

  it("longest_streak dispara con >=7 días", () => {
    const analytics = buildAnalyticsFixture({ streaks: { currentStreak: 2, longestStreak: 10, streakStart: "2026-01-01", streakEnd: "2026-01-10" } });
    expect(detectLongestStreak({ analytics, periodDays: 30 })?.data.longestStreak).toBe(10);
  });

  it("active_streak no dispara si la racha actual ES la más larga (longest_streak ya lo cubre)", () => {
    const analytics = buildAnalyticsFixture({ streaks: { currentStreak: 10, longestStreak: 10, streakStart: "2026-01-01", streakEnd: "2026-01-10" } });
    expect(detectActiveStreak({ analytics, periodDays: 30 })).toBeNull();
    expect(detectLongestStreak({ analytics, periodDays: 30 })).not.toBeNull();
  });

  it("active_streak dispara cuando hay una racha activa menor que el récord histórico", () => {
    const analytics = buildAnalyticsFixture({ streaks: { currentStreak: 4, longestStreak: 20, streakStart: "2025-01-01", streakEnd: "2025-01-20" } });
    expect(detectActiveStreak({ analytics, periodDays: 30 })?.data.currentStreak).toBe(4);
  });
});

describe("detectAll", () => {
  it("con datos completamente neutros no dispara ningún insight", () => {
    const analytics = buildAnalyticsFixture();
    expect(detectAll({ analytics, periodDays: 30 })).toHaveLength(0);
  });
});
