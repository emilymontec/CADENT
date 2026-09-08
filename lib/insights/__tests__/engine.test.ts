import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { aiUsageLog: { create: vi.fn().mockResolvedValue(undefined) } }
}));

import { generateInsights } from "@/lib/insights/engine";
import { buildAnalyticsFixture } from "@/lib/insights/__tests__/fixtures";

describe("generateInsights (end-to-end, sin IA)", () => {
  it("detecta, rankea y narra con plantillas cuando useAI es false", async () => {
    const analytics = buildAnalyticsFixture({
      commitStats: {
        totalCommits: 50,
        averageCommitsPerDay: 1.6,
        averageCommitsPerWeek: 11.6,
        averageCommitsPerMonth: 50,
        activeDays: 25
      },
      temporal: {
        ...buildAnalyticsFixture().temporal,
        nightActivityPercentage: 70,
        mostActiveHour: 23
      },
      streaks: { currentStreak: 3, longestStreak: 15, streakStart: "2026-01-01", streakEnd: "2026-01-15" }
    });

    const results = await generateInsights(
      { analytics, periodDays: 30 },
      { userId: "u1", useAI: false }
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.source === "TEMPLATE")).toBe(true);
    expect(results.every((r) => r.narrative.length > 0)).toBe(true);

    const types = results.map((r) => r.type);
    expect(types).toContain("night_owl");
    expect(types).toContain("longest_streak");
  });

  it("respeta el límite maxInsights", async () => {
    const analytics = buildAnalyticsFixture({
      commitStats: {
        totalCommits: 100,
        averageCommitsPerDay: 3,
        averageCommitsPerWeek: 20,
        averageCommitsPerMonth: 100,
        activeDays: 90
      },
      temporal: {
        ...buildAnalyticsFixture().temporal,
        nightActivityPercentage: 80,
        weekendActivityPercentage: 60
      },
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
      },
      streaks: { currentStreak: 5, longestStreak: 30, streakStart: "2026-01-01", streakEnd: "2026-01-30" }
    });

    const results = await generateInsights(
      { analytics, periodDays: 100 },
      { userId: "u1", useAI: false, maxInsights: 2 }
    );

    expect(results).toHaveLength(2);
  });

  it("no genera ningún insight cuando los datos son insuficientes", async () => {
    const analytics = buildAnalyticsFixture();
    const results = await generateInsights(
      { analytics, periodDays: 30 },
      { userId: "u1", useAI: false }
    );
    expect(results).toHaveLength(0);
  });
});
