import type { AnalyticsCommitInput } from "@/lib/analytics/types";
import { daysBetween, shiftDateKey, toLocalDateParts } from "@/lib/analytics/timezone";

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  streakStart: string | null;
  streakEnd: string | null;
}

/**
 * ⚠️ Corrección sección 15: el cálculo de "día con actividad" se hace sobre
 * la fecha ya normalizada a la timezone del usuario (sección 14.4), no
 * sobre UTC — de lo contrario una racha real puede aparecer "rota" por un
 * simple desfase horario (p. ej. un commit a las 11pm hora local cae al
 * día siguiente en UTC).
 */
export function calculateStreaks(
  commits: AnalyticsCommitInput[],
  timezone: string,
  referenceDate: Date = new Date()
): StreakResult {
  if (commits.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakStart: null, streakEnd: null };
  }

  const dayKeys = Array.from(
    new Set(commits.map((c) => toLocalDateParts(c.date, timezone).dateKey))
  ).sort();

  let longestStreak = 1;
  let longestStreakStartIdx = 0;
  let longestStreakEndIdx = 0;
  let runStartIdx = 0;

  for (let i = 1; i < dayKeys.length; i++) {
    if (daysBetween(dayKeys[i - 1], dayKeys[i]) === 1) {
      const runLength = i - runStartIdx + 1;
      if (runLength > longestStreak) {
        longestStreak = runLength;
        longestStreakStartIdx = runStartIdx;
        longestStreakEndIdx = i;
      }
    } else {
      runStartIdx = i;
    }
  }

  // Racha actual: solo cuenta si el último día con actividad es "hoy" o
  // "ayer" en la timezone del usuario — si no, la racha ya se rompió.
  const todayKey = toLocalDateParts(referenceDate, timezone).dateKey;
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const lastDayKey = dayKeys[dayKeys.length - 1];

  let currentStreak = 0;
  if (lastDayKey === todayKey || lastDayKey === yesterdayKey) {
    currentStreak = 1;
    for (let i = dayKeys.length - 1; i > 0; i--) {
      if (daysBetween(dayKeys[i - 1], dayKeys[i]) === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    streakStart: dayKeys[longestStreakStartIdx],
    streakEnd: dayKeys[longestStreakEndIdx]
  };
}
