/**
 * ⚠️ Corrección sección 14.4: los commits llegan en UTC. Calcular "hora más
 * activa" o "día más activo" directamente sobre UTC produce resultados
 * incorrectos para cualquier usuario fuera de ese huso horario — un commit
 * a las 11pm hora local puede registrarse como "otro día" en UTC.
 *
 * Este módulo es el único punto donde ocurre esa conversión; todo lo
 * demás en el Analytics Engine (activity, streaks) depende de él en vez
 * de leer Date directamente.
 *
 * Se usa Intl.DateTimeFormat en vez de una librería de timezones porque
 * Node ya trae la base de datos IANA embebida — no hace falta una
 * dependencia extra para esto.
 */

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface LocalDateParts {
  /** YYYY-MM-DD en la zona horaria local del usuario */
  dateKey: string;
  /** 0-23, hora local */
  hour: number;
  weekday: Weekday;
  weekdayIndex: number;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Devuelve `timezone` si es válida, o "UTC" como fallback seguro. */
export function safeTimezone(timezone: string | null | undefined): string {
  if (timezone && isValidTimezone(timezone)) return timezone;
  return "UTC";
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23", // evita el caso "24:00" que produce h12/h24 al pedir medianoche
    weekday: "long"
  });
  formatterCache.set(timezone, formatter);
  return formatter;
}

export function toLocalDateParts(utcDate: Date, timezone: string): LocalDateParts {
  const tz = safeTimezone(timezone);
  const parts = getFormatter(tz).formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const dateKey = `${map.year}-${map.month}-${map.day}`;
  const hour = Number(map.hour) % 24;
  const weekday = map.weekday as Weekday;
  const weekdayIndex = WEEKDAYS.indexOf(weekday);

  return { dateKey, hour, weekday, weekdayIndex };
}

export function daysBetween(dateKeyA: string, dateKeyB: string): number {
  const a = new Date(`${dateKeyA}T00:00:00Z`).getTime();
  const b = new Date(`${dateKeyB}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
