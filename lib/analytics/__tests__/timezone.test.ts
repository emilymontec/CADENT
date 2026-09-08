import { describe, expect, it } from "vitest";
import { toLocalDateParts, daysBetween, shiftDateKey, safeTimezone } from "@/lib/analytics/timezone";

describe("toLocalDateParts", () => {
  it("mantiene el mismo día calendario en UTC", () => {
    // 2026-06-15T12:00:00Z, mediodía UTC
    const parts = toLocalDateParts(new Date("2026-06-15T12:00:00Z"), "UTC");
    expect(parts.dateKey).toBe("2026-06-15");
    expect(parts.hour).toBe(12);
    expect(parts.weekday).toBe("Monday");
  });

  it("empuja al día ANTERIOR para un usuario en un huso horario negativo (America/New_York)", () => {
    // 23:30 UTC del 15 de junio = 19:30 hora de Nueva York (UTC-4 en horario de verano) → mismo día
    // Pero 02:30 UTC del 16 de junio = 22:30 del 15 de junio en Nueva York → día anterior
    const parts = toLocalDateParts(new Date("2026-06-16T02:30:00Z"), "America/New_York");
    expect(parts.dateKey).toBe("2026-06-15");
    expect(parts.hour).toBe(22);
  });

  it("empuja al día SIGUIENTE para un usuario en un huso horario positivo (Asia/Tokyo)", () => {
    // 23:30 UTC del 15 de junio = 08:30 del 16 de junio en Tokio (UTC+9)
    const parts = toLocalDateParts(new Date("2026-06-15T23:30:00Z"), "Asia/Tokyo");
    expect(parts.dateKey).toBe("2026-06-16");
    expect(parts.hour).toBe(8);
  });

  it("nunca produce hour=24 a medianoche local", () => {
    // 00:00 en Asia/Kolkata (UTC+5:30) cae en 18:30 UTC del día anterior
    const parts = toLocalDateParts(new Date("2026-06-14T18:30:00Z"), "Asia/Kolkata");
    expect(parts.hour).toBe(0);
    expect(parts.dateKey).toBe("2026-06-15");
  });
});

describe("safeTimezone", () => {
  it("acepta una timezone IANA válida", () => {
    expect(safeTimezone("Europe/Madrid")).toBe("Europe/Madrid");
  });

  it("cae a UTC si la timezone es inválida o está vacía", () => {
    expect(safeTimezone("Not/AZone")).toBe("UTC");
    expect(safeTimezone(null)).toBe("UTC");
    expect(safeTimezone(undefined)).toBe("UTC");
  });
});

describe("daysBetween / shiftDateKey", () => {
  it("calcula la diferencia en días calendario", () => {
    expect(daysBetween("2026-06-15", "2026-06-16")).toBe(1);
    expect(daysBetween("2026-06-15", "2026-06-15")).toBe(0);
    expect(daysBetween("2026-06-15", "2026-06-10")).toBe(-5);
  });

  it("desplaza una dateKey N días", () => {
    expect(shiftDateKey("2026-06-15", -1)).toBe("2026-06-14");
    expect(shiftDateKey("2026-06-15", 1)).toBe("2026-06-16");
    // cruza fin de mes correctamente
    expect(shiftDateKey("2026-06-30", 1)).toBe("2026-07-01");
  });
});
