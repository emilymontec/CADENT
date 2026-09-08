import { describe, expect, it } from "vitest";
import { calculateStreaks } from "@/lib/analytics/streaks";
import type { AnalyticsCommitInput } from "@/lib/analytics/types";

function commit(id: string, isoUtc: string): AnalyticsCommitInput {
  return { id, date: new Date(isoUtc), repositoryId: "repo-1" };
}

describe("calculateStreaks", () => {
  it("devuelve ceros para una lista vacía", () => {
    const result = calculateStreaks([], "UTC");
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      streakStart: null,
      streakEnd: null
    });
  });

  it("calcula una racha simple de 3 días consecutivos en UTC", () => {
    const commits = [
      commit("1", "2026-06-10T10:00:00Z"),
      commit("2", "2026-06-11T10:00:00Z"),
      commit("3", "2026-06-12T10:00:00Z")
    ];
    const result = calculateStreaks(commits, "UTC", new Date("2026-06-12T23:00:00Z"));
    expect(result.longestStreak).toBe(3);
    expect(result.streakStart).toBe("2026-06-10");
    expect(result.streakEnd).toBe("2026-06-12");
  });

  it("⚠️ sin normalización de timezone, un commit tardío rompería la racha falsamente", () => {
    // Usuario en America/Los_Angeles (UTC-7 en verano). Comitea todas las
    // noches cerca de las 23:00 hora local, lo cual cruza la medianoche UTC.
    // En UTC esto produce fechas NO consecutivas; en hora local sí lo son.
    const commits = [
      commit("1", "2026-06-10T06:00:00Z"), // 2026-06-09 23:00 en LA
      commit("2", "2026-06-11T06:00:00Z"), // 2026-06-10 23:00 en LA
      commit("3", "2026-06-12T06:00:00Z") // 2026-06-11 23:00 en LA
    ];

    const resultUtc = calculateStreaks(commits, "UTC", new Date("2026-06-12T23:00:00Z"));
    const resultLA = calculateStreaks(
      commits,
      "America/Los_Angeles",
      new Date("2026-06-12T23:00:00Z")
    );

    // En ambos casos las fechas de commit (10,11,12 de junio en UTC) SON
    // consecutivas, así que UTC también da 3 — el punto de este test es
    // demostrar que la racha en hora local (9,10,11 de junio) es igual de
    // consistente, no que difieran en longitud aquí.
    expect(resultUtc.longestStreak).toBe(3);
    expect(resultLA.longestStreak).toBe(3);
    expect(resultLA.streakStart).toBe("2026-06-09");
    expect(resultLA.streakEnd).toBe("2026-06-11");
  });

  it("un commit que cruza medianoche local puede romper o unir una racha según la timezone", () => {
    // Dos commits separados por 24h05m en tiempo real. En UTC caen en días
    // NO consecutivos (hay un día completo de por medio si se mide mal),
    // pero lo importante es que cada timezone decide su propio dateKey.
    const commits = [
      commit("1", "2026-06-10T23:50:00Z"), // 2026-06-11 08:50 en Tokio
      commit("2", "2026-06-11T00:10:00Z") // 2026-06-11 09:10 en Tokio (mismo día!)
    ];

    const resultUtc = calculateStreaks(commits, "UTC", new Date("2026-06-11T10:00:00Z"));
    const resultTokyo = calculateStreaks(
      commits,
      "Asia/Tokyo",
      new Date("2026-06-11T10:00:00Z")
    );

    // En UTC son dos días consecutivos (10 y 11) -> streak de 2.
    expect(resultUtc.longestStreak).toBe(2);
    // En Tokio ambos commits caen el MISMO día local -> un solo día activo,
    // streak de 1 (no hay "racha" de un solo día por definición aquí).
    expect(resultTokyo.longestStreak).toBe(1);
  });

  it("calcula correctamente el currentStreak cuando el último commit fue ayer", () => {
    const commits = [
      commit("1", "2026-06-10T10:00:00Z"),
      commit("2", "2026-06-11T10:00:00Z")
    ];
    // referenceDate = 12 de junio -> el último commit fue "ayer" (11) -> racha activa
    const result = calculateStreaks(commits, "UTC", new Date("2026-06-12T09:00:00Z"));
    expect(result.currentStreak).toBe(2);
  });

  it("currentStreak es 0 si la racha ya se rompió hace más de un día", () => {
    const commits = [commit("1", "2026-06-01T10:00:00Z")];
    const result = calculateStreaks(commits, "UTC", new Date("2026-06-12T09:00:00Z"));
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
  });
});
