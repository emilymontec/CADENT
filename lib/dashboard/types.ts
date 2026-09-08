import type { AnalyticsResult } from "@/lib/analytics/engine";
import type { PersistedInsight } from "@/lib/insights/types";

export interface DashboardData {
  analytics: AnalyticsResult;
  insights: PersistedInsight[];
}
