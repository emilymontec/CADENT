import type { AnalyticsCommitInput, AnalyticsPeriod } from "@/lib/analytics/types";
import { toLocalDateParts, WEEKDAYS, shiftDateKey, type Weekday } from "@/lib/analytics/timezone";

export interface HourBucket {
  hour: number;
  count: number;
}

export interface WeekdayBucket {
  weekday: Weekday;
  count: number;
}

export interface DayBucket {
  /** YYYY-MM-DD en la timezone del usuario */
  date: string;
  count: number;
}

/**
 * ⚠️ Todas las funciones de este módulo reciben `timezone` explícitamente
 * y pasan por toLocalDateParts (sección 14.4). Ninguna debe leer
 * `commit.date.getUTCHours()` / `getUTCDay()` directamente — eso es
 * precisamente el bug que la corrección de la sección 14.4 previene.
 */

export function buildHourlyDistribution(
  commits: AnalyticsCommitInput[],
  timezone: string
): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const commit of commits) {
    const { hour } = toLocalDateParts(commit.date, timezone);
    buckets[hour].count += 1;
  }
  return buckets;
}

export function buildWeekdayDistribution(
  commits: AnalyticsCommitInput[],
  timezone: string
): WeekdayBucket[] {
  const counts = new Map<Weekday, number>(WEEKDAYS.map((w) => [w, 0]));
  for (const commit of commits) {
    const { weekday } = toLocalDateParts(commit.date, timezone);
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  return WEEKDAYS.map((weekday) => ({ weekday, count: counts.get(weekday) ?? 0 }));
}

export function findMostActiveHour(commits: AnalyticsCommitInput[], timezone: string): number | null {
  if (commits.length === 0) return null;
  const distribution = buildHourlyDistribution(commits, timezone);
  return distribution.reduce((max, bucket) => (bucket.count > max.count ? bucket : max)).hour;
}

export function findMostActiveDay(
  commits: AnalyticsCommitInput[],
  timezone: string
): Weekday | null {
  if (commits.length === 0) return null;
  const distribution = buildWeekdayDistribution(commits, timezone);
  return distribution.reduce((max, bucket) => (bucket.count > max.count ? bucket : max)).weekday;
}

/** Porcentaje de commits entre nightStartHour (inclusive) y nightEndHour (exclusive), hora local. Default: 6pm-6am. */
export function nightActivityPercentage(
  commits: AnalyticsCommitInput[],
  timezone: string,
  nightStartHour = 18,
  nightEndHour = 6
): number {
  if (commits.length === 0) return 0;
  let nightCommits = 0;
  for (const commit of commits) {
    const { hour } = toLocalDateParts(commit.date, timezone);
    const isNight = hour >= nightStartHour || hour < nightEndHour;
    if (isNight) nightCommits += 1;
  }
  return Math.round((nightCommits / commits.length) * 10000) / 100;
}

export function weekendActivityPercentage(
  commits: AnalyticsCommitInput[],
  timezone: string
): number {
  if (commits.length === 0) return 0;
  let weekendCommits = 0;
  for (const commit of commits) {
    const { weekday } = toLocalDateParts(commit.date, timezone);
    if (weekday === "Saturday" || weekday === "Sunday") weekendCommits += 1;
  }
  return Math.round((weekendCommits / commits.length) * 10000) / 100;
}

/**
 * Distribución diaria — un bucket por cada día calendario dentro de
 * `period`, incluyendo los días sin actividad (count: 0). Es lo que
 * necesita cualquier heatmap estilo "contribution graph": el heatmap NO
 * debe inferir días faltantes ni calcular esto en el componente de UI
 * (sección de Consideraciones de la Fase 2 del roadmap de producto) — es
 * responsabilidad del Analytics Engine, igual que el resto de esta
 * capa de "temporal analysis".
 */
export function buildDailyDistribution(
  commits: AnalyticsCommitInput[],
  timezone: string,
  period: AnalyticsPeriod
): DayBucket[] {
  const countsByDate = new Map<string, number>();
  for (const commit of commits) {
    const { dateKey } = toLocalDateParts(commit.date, timezone);
    countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
  }

  const startKey = toLocalDateParts(period.start, timezone).dateKey;
  const endKey = toLocalDateParts(period.end, timezone).dateKey;

  const buckets: DayBucket[] = [];
  let cursor = startKey;
  // Tope de seguridad: nunca iterar más de ~10 años de días, para que un
  // period mal formado (end < start) no cause un loop infinito.
  let safety = 0;
  while (cursor <= endKey && safety < 3660) {
    buckets.push({ date: cursor, count: countsByDate.get(cursor) ?? 0 });
    cursor = shiftDateKey(cursor, 1);
    safety += 1;
  }

  return buckets;
}
