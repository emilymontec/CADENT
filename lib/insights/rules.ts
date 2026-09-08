import type { DetectedInsight, InsightDetectionInput } from "@/lib/insights/types";

/**
 * ⚠️ Regla de oro (sección 16): estas funciones LEEN métricas ya
 * calculadas por el Analytics Engine. Ninguna suma, promedia o
 * recalcula un porcentaje que el Analytics Engine no haya calculado ya
 * — si hiciera falta un dato nuevo, se agrega al Analytics Engine, no
 * aquí. Esto es lo que mantiene el pipeline "datos → Analytics Engine →
 * métricas → Insights Engine → lenguaje natural" y nunca al revés.
 *
 * Cada regla también aplica un umbral de tamaño de muestra mínimo — con
 * pocos commits, cualquier porcentaje es ruido, no un patrón real.
 */

const MIN_SAMPLE_COMMITS = 15;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function detectNightOwl({ analytics }: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, temporal } = analytics;
  if (commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;
  if (temporal.nightActivityPercentage < 40) return null;

  return {
    type: "night_owl",
    priority: 50 + Math.round(temporal.nightActivityPercentage / 2),
    data: {
      nightActivityPercentage: temporal.nightActivityPercentage,
      mostActiveHour: temporal.mostActiveHour ?? 0
    }
  };
}

export function detectEarlyBird({ analytics }: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, temporal } = analytics;
  if (commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;

  const earlyHours = new Set([5, 6, 7, 8, 9]);
  const earlyCommits = temporal.hourlyDistribution
    .filter((b) => earlyHours.has(b.hour))
    .reduce((sum, b) => sum + b.count, 0);
  const earlyPercentage = round1((earlyCommits / commitStats.totalCommits) * 100);

  if (earlyPercentage < 30) return null;

  return {
    type: "early_bird",
    priority: 50 + Math.round(earlyPercentage / 2),
    data: { earlyPercentage, mostActiveHour: temporal.mostActiveHour ?? 0 }
  };
}

export function detectWeekendWarrior({
  analytics
}: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, temporal } = analytics;
  if (commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;
  // Baseline: 2/7 ≈ 28.6% de los días son fin de semana. Umbral por
  // encima de eso para que sea un patrón, no la distribución esperada.
  if (temporal.weekendActivityPercentage < 35) return null;

  return {
    type: "weekend_warrior",
    priority: 45 + Math.round(temporal.weekendActivityPercentage / 2),
    data: { weekendActivityPercentage: temporal.weekendActivityPercentage }
  };
}

export function detectConsistentCommitter({
  analytics,
  periodDays
}: InsightDetectionInput): DetectedInsight | null {
  const { commitStats } = analytics;
  if (commitStats.totalCommits < MIN_SAMPLE_COMMITS || periodDays <= 0) return null;

  const activeDayRatio = round1((commitStats.activeDays / periodDays) * 100);
  if (activeDayRatio < 50) return null;

  return {
    type: "consistent_committer",
    priority: 40 + Math.round(activeDayRatio / 3),
    data: { activeDayRatio, activeDays: commitStats.activeDays, periodDays }
  };
}

export function detectLanguageLoyalist({
  analytics
}: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, languageStats } = analytics;
  const top = languageStats.distribution[0];
  if (!top || commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;
  if (top.percentage < 80) return null;

  return {
    type: "language_loyalist",
    priority: 40 + Math.round(top.percentage / 3),
    data: { language: top.language, percentage: top.percentage }
  };
}

export function detectPolyglot({ analytics }: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, languageStats } = analytics;
  if (commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;
  if (languageStats.languageCount < 4 || languageStats.languageDiversity < 0.7) return null;

  return {
    type: "polyglot",
    priority: 35 + Math.round(languageStats.languageDiversity * 20),
    data: {
      languageCount: languageStats.languageCount,
      languageDiversity: languageStats.languageDiversity
    }
  };
}

export function detectMonoRepoFocus({
  analytics
}: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, repositoryStats } = analytics;
  const top = repositoryStats.repositoryDistribution[0];
  if (!top || commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;
  // Requiere al menos 2 repos activos — con un solo repo total, "enfoque"
  // no es un patrón, es la única opción que había.
  if (repositoryStats.activeRepositories < 2) return null;
  if (top.percentage < 70) return null;

  return {
    type: "mono_repo_focus",
    priority: 35 + Math.round(top.percentage / 3),
    data: { repository: top.name, percentage: top.percentage }
  };
}

export function detectSerialStarter({
  analytics
}: InsightDetectionInput): DetectedInsight | null {
  const { commitStats, repositoryStats } = analytics;
  if (commitStats.totalCommits < MIN_SAMPLE_COMMITS) return null;
  if (repositoryStats.activeRepositories < 5) return null;

  const avgCommitsPerRepo = commitStats.totalCommits / repositoryStats.activeRepositories;
  if (avgCommitsPerRepo >= 5) return null;

  return {
    type: "serial_starter",
    priority: 30 + repositoryStats.activeRepositories,
    data: {
      activeRepositories: repositoryStats.activeRepositories,
      avgCommitsPerRepo: round1(avgCommitsPerRepo)
    }
  };
}

export function detectLongestStreak({ analytics }: InsightDetectionInput): DetectedInsight | null {
  const { streaks } = analytics;
  if (streaks.longestStreak < 7) return null;

  return {
    type: "longest_streak",
    priority: 55 + Math.min(streaks.longestStreak, 40),
    data: {
      longestStreak: streaks.longestStreak,
      streakStart: streaks.streakStart ?? "",
      streakEnd: streaks.streakEnd ?? ""
    }
  };
}

export function detectActiveStreak({ analytics }: InsightDetectionInput): DetectedInsight | null {
  const { streaks } = analytics;
  if (streaks.currentStreak < 3) return null;
  // Si la racha actual ES la más larga, ya la cubre longest_streak con
  // más peso narrativo ("récord") — evita mostrar el mismo dato dos veces.
  if (streaks.currentStreak >= streaks.longestStreak) return null;

  return {
    type: "active_streak",
    priority: 45 + Math.min(streaks.currentStreak, 30),
    data: { currentStreak: streaks.currentStreak }
  };
}

export const ALL_RULES = [
  detectNightOwl,
  detectEarlyBird,
  detectWeekendWarrior,
  detectConsistentCommitter,
  detectLanguageLoyalist,
  detectPolyglot,
  detectMonoRepoFocus,
  detectSerialStarter,
  detectLongestStreak,
  detectActiveStreak
] as const;

export function detectAll(input: InsightDetectionInput): DetectedInsight[] {
  return ALL_RULES.map((rule) => rule(input)).filter((insight): insight is DetectedInsight =>
    Boolean(insight)
  );
}
