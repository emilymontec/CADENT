import type { AnalyticsLanguageInput } from "@/lib/analytics/types";

export interface LanguageDistributionEntry {
  language: string;
  totalBytes: number;
  percentage: number;
}

export interface LanguageStats {
  topLanguage: string | null;
  distribution: LanguageDistributionEntry[];
  languageCount: number;
  /** Entropía de Shannon normalizada a [0,1]. 0 = un solo lenguaje domina, 1 = uso perfectamente repartido. */
  languageDiversity: number;
}

/**
 * LanguageStat es una serie de tiempo (sección 9/26: un registro por
 * repo+lenguaje+capturedAt), no un snapshot único. Para las métricas del
 * período actual tomamos, por repo+lenguaje, únicamente el registro más
 * reciente — la evolución histórica completa se usa en "Language
 * Evolution" (sección 26), no aquí.
 */
function latestSnapshotPerRepoLanguage(
  languageStats: AnalyticsLanguageInput[]
): AnalyticsLanguageInput[] {
  const latest = new Map<string, AnalyticsLanguageInput>();
  for (const stat of languageStats) {
    const key = `${stat.repositoryId}:${stat.language}`;
    const existing = latest.get(key);
    if (!existing || stat.capturedAt.getTime() > existing.capturedAt.getTime()) {
      latest.set(key, stat);
    }
  }
  return Array.from(latest.values());
}

export function calculateLanguageDistribution(
  languageStats: AnalyticsLanguageInput[]
): LanguageDistributionEntry[] {
  const snapshots = latestSnapshotPerRepoLanguage(languageStats);

  const totalsByLanguage = new Map<string, number>();
  for (const stat of snapshots) {
    totalsByLanguage.set(stat.language, (totalsByLanguage.get(stat.language) ?? 0) + stat.bytes);
  }

  const totalBytes = Array.from(totalsByLanguage.values()).reduce((a, b) => a + b, 0);
  if (totalBytes === 0) return [];

  return Array.from(totalsByLanguage.entries())
    .map(([language, bytes]) => ({
      language,
      totalBytes: bytes,
      percentage: Math.round((bytes / totalBytes) * 10000) / 100
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);
}

export function calculateLanguageDiversity(distribution: LanguageDistributionEntry[]): number {
  if (distribution.length <= 1) return 0;
  const entropy = distribution.reduce((sum, entry) => {
    const p = entry.percentage / 100;
    return p > 0 ? sum - p * Math.log2(p) : sum;
  }, 0);
  const maxEntropy = Math.log2(distribution.length);
  return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) / 100 : 0;
}

export function calculateLanguageStats(languageStats: AnalyticsLanguageInput[]): LanguageStats {
  const distribution = calculateLanguageDistribution(languageStats);
  return {
    topLanguage: distribution[0]?.language ?? null,
    distribution,
    languageCount: distribution.length,
    languageDiversity: calculateLanguageDiversity(distribution)
  };
}
