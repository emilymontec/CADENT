import { describe, expect, it } from "vitest";
import {
  buildDailyDistribution,
  buildHourlyDistribution,
  buildWeekdayDistribution,
  findMostActiveDay,
  findMostActiveHour,
  nightActivityPercentage,
  weekendActivityPercentage
} from "@/lib/analytics/activity";
import type { AnalyticsCommitInput } from "@/lib/analytics/types";

function commit(id: string, isoUtc: string, repositoryId = "repo-1"): AnalyticsCommitInput {
  return { id, date: new Date(isoUtc), repositoryId };
}

describe("findMostActiveHour / findMostActiveDay — mismo set de commits, distintas timezones", () => {
  // 5 commits concentrados cerca de 23:00-01:00 UTC un martes/miércoles.
  // En UTC esto se reparte entre dos días; en un usuario con offset
  // suficientemente grande, todos caen en un único día/hora local.
  const commits: AnalyticsCommitInput[] = [
    commit("1", "2026-06-16T23:15:00Z"), // martes tarde UTC
    commit("2", "2026-06-16T23:45:00Z"),
    commit("3", "2026-06-17T00:05:00Z"), // miércoles muy temprano UTC
    commit("4", "2026-06-17T00:20:00Z"),
    commit("5", "2026-06-17T00:40:00Z")
  ];

  it("en UTC, la actividad queda partida entre martes y miércoles", () => {
    const dayDist = buildWeekdayDistribution(commits, "UTC");
    const tuesday = dayDist.find((d) => d.weekday === "Tuesday")!;
    const wednesday = dayDist.find((d) => d.weekday === "Wednesday")!;
    expect(tuesday.count).toBe(2);
    expect(wednesday.count).toBe(3);
  });

  it("en Asia/Tokyo (UTC+9), toda la actividad cae en un solo día local (miércoles)", () => {
    // 23:15 UTC martes -> 08:15 miércoles en Tokio; todos los commits caen el miércoles.
    const mostActiveDay = findMostActiveDay(commits, "Asia/Tokyo");
    expect(mostActiveDay).toBe("Wednesday");

    const dayDist = buildWeekdayDistribution(commits, "Asia/Tokyo");
    const wednesday = dayDist.find((d) => d.weekday === "Wednesday")!;
    expect(wednesday.count).toBe(5);
  });

  it("en America/Los_Angeles (UTC-7 en verano), toda la actividad cae el martes local", () => {
    // 00:40 UTC miércoles -> 17:40 martes en LA; todos los commits caen el martes.
    const mostActiveDay = findMostActiveDay(commits, "America/Los_Angeles");
    expect(mostActiveDay).toBe("Tuesday");
  });

  it("la hora más activa cambia según la timezone del usuario para el mismo set de commits", () => {
    const hourUTC = findMostActiveHour(commits, "UTC");
    const hourTokyo = findMostActiveHour(commits, "Asia/Tokyo");
    const hourLA = findMostActiveHour(commits, "America/Los_Angeles");

    // Mismos commits, tres respuestas distintas — confirma que la
    // normalización de timezone realmente afecta el resultado (sección 14.4).
    expect(hourUTC).not.toBeNull();
    expect(hourTokyo).not.toBeNull();
    expect(hourLA).not.toBeNull();
    expect(new Set([hourUTC, hourTokyo, hourLA]).size).toBeGreaterThan(1);
  });
});

describe("edge cases", () => {
  it("devuelve null / 0 para una lista de commits vacía", () => {
    expect(findMostActiveHour([], "UTC")).toBeNull();
    expect(findMostActiveDay([], "UTC")).toBeNull();
    expect(nightActivityPercentage([], "UTC")).toBe(0);
    expect(weekendActivityPercentage([], "UTC")).toBe(0);
  });

  it("buildHourlyDistribution siempre devuelve 24 buckets, incluso sin commits en algunas horas", () => {
    const dist = buildHourlyDistribution([commit("1", "2026-06-16T10:00:00Z")], "UTC");
    expect(dist).toHaveLength(24);
    expect(dist[10].count).toBe(1);
    expect(dist[11].count).toBe(0);
  });
});

describe("nightActivityPercentage / weekendActivityPercentage", () => {  it("clasifica correctamente commits nocturnos vs diurnos en timezone local", () => {
    const commits = [
      commit("1", "2026-06-16T22:00:00Z"), // 22:00 UTC -> noche
      commit("2", "2026-06-16T13:00:00Z") // 13:00 UTC -> día
    ];
    expect(nightActivityPercentage(commits, "UTC")).toBe(50);
  });

  it("un fin de semana en UTC puede no serlo en otra timezone y viceversa", () => {
    // Sábado 2026-06-20T02:00:00Z -> viernes 2026-06-19 en America/Los_Angeles (UTC-7)
    const saturdayUtcButFridayLA = [commit("1", "2026-06-20T02:00:00Z")];
    expect(weekendActivityPercentage(saturdayUtcButFridayLA, "UTC")).toBe(100);
    expect(weekendActivityPercentage(saturdayUtcButFridayLA, "America/Los_Angeles")).toBe(0);
  });
});

describe("buildDailyDistribution", () => {
  it("incluye un bucket por cada día del período, incluso sin commits", () => {
    const period = { start: new Date("2026-06-01T00:00:00Z"), end: new Date("2026-06-05T00:00:00Z") };
    const buckets = buildDailyDistribution([commit("1", "2026-06-03T10:00:00Z")], "UTC", period);

    expect(buckets).toHaveLength(5);
    expect(buckets.map((b) => b.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05"
    ]);
    expect(buckets.find((b) => b.date === "2026-06-03")?.count).toBe(1);
    expect(buckets.find((b) => b.date === "2026-06-01")?.count).toBe(0);
  });

  it("agrupa por fecha local, no UTC — un commit puede caer un día distinto según la timezone", () => {
    const period = { start: new Date("2026-06-15T00:00:00Z"), end: new Date("2026-06-17T00:00:00Z") };
    // 23:30 UTC del 15 -> 08:30 del 16 en Tokio
    const buckets = buildDailyDistribution([commit("1", "2026-06-15T23:30:00Z")], "Asia/Tokyo", period);

    expect(buckets.find((b) => b.date === "2026-06-15")?.count).toBe(0);
    expect(buckets.find((b) => b.date === "2026-06-16")?.count).toBe(1);
  });

  it("nunca entra en loop infinito con un período invertido (end < start)", () => {
    const period = { start: new Date("2026-06-10T00:00:00Z"), end: new Date("2026-06-01T00:00:00Z") };
    const buckets = buildDailyDistribution([], "UTC", period);
    expect(buckets).toEqual([]);
  });
});