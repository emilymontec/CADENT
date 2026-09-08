/**
 * Los tres períodos que ofrece el selector del dashboard (Fase 2 del
 * roadmap de producto). Es una función pura a propósito — tanto el
 * servidor (render inicial) como los Route Handlers (cambios de período
 * desde el cliente) deben resolver exactamente el mismo rango para el
 * mismo `PeriodOption`, o el dashboard mostraría números distintos según
 * cómo se haya cargado.
 */
export const PERIOD_OPTIONS = ["last30", "calendarYear", "rolling12"] as const;
export type PeriodOption = (typeof PERIOD_OPTIONS)[number];

export interface ResolvedPeriod {
  start: Date;
  end: Date;
}

export function isPeriodOption(value: string | null): value is PeriodOption {
  return value !== null && (PERIOD_OPTIONS as readonly string[]).includes(value);
}

/**
 * ⚠️ Los límites de "año calendario" se calculan en UTC, no en la
 * timezone del usuario. Es una simplificación deliberada: el Analytics
 * Engine ya normaliza cada commit individual a la timezone del usuario
 * (sección 14.4) para clasificar día/hora, así que el único efecto de
 * este límite en UTC es incluir o excluir, como mucho, unas pocas horas
 * de commits en el borde del año — no vale la pena la complejidad de
 * resolver el 1 de enero en la timezone de cada usuario todavía. Revisar
 * si en algún momento se vuelve una queja real de usuarios.
 *
 * ⚠️ El período se trunca al día UTC (medianoche), no al segundo exacto.
 * Esto es lo que permite que el job de Inngest que genera insights
 * (corre en segundo plano, con latencia variable) y el Route Handler que
 * los sirve (corre cuando el usuario visita el dashboard, minutos u
 * horas después) calculen el MISMO `periodStart`/`periodEnd` para el
 * mismo `PeriodOption` en el mismo día — si se usara el timestamp exacto
 * del momento de cada llamada, ambos nunca coincidirían y los insights
 * jamás matchearían con el período que el dashboard está pidiendo.
 */
function truncateToUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function resolvePeriod(option: PeriodOption, referenceDate: Date = new Date()): ResolvedPeriod {
  const end = truncateToUtcDate(referenceDate);

  if (option === "calendarYear") {
    return { start: new Date(Date.UTC(end.getUTCFullYear(), 0, 1)), end };
  }

  if (option === "rolling12") {
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    return { start, end };
  }

  // last30
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return { start, end };
}

export const PERIOD_LABELS: Record<PeriodOption, string> = {
  last30: "Últimos 30 días",
  calendarYear: "Este año",
  rolling12: "Últimos 12 meses"
};
