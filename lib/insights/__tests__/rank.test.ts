import { describe, expect, it } from "vitest";
import { rankInsights } from "@/lib/insights/rank";
import type { DetectedInsight } from "@/lib/insights/types";

function insight(type: DetectedInsight["type"], priority: number): DetectedInsight {
  return { type, priority, data: {} };
}

describe("rankInsights", () => {
  it("ordena por prioridad descendente", () => {
    const result = rankInsights([insight("night_owl", 10), insight("polyglot", 90)]);
    expect(result.map((i) => i.type)).toEqual(["polyglot", "night_owl"]);
  });

  it("limita al máximo indicado", () => {
    // Usa tipos distintos — en la práctica detectAll nunca produce dos
    // insights del mismo tipo, así que el límite se prueba con variedad
    // real, no con duplicados artificiales.
    const many: DetectedInsight[] = [
      insight("longest_streak", 90),
      insight("active_streak", 80),
      insight("consistent_committer", 70),
      insight("night_owl", 60),
      insight("weekend_warrior", 50)
    ];
    const result = rankInsights(many, 3);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.type)).toEqual([
      "longest_streak",
      "active_streak",
      "consistent_committer"
    ]);
  });

  it("resuelve night_owl vs early_bird quedándose con el de mayor prioridad", () => {
    const result = rankInsights([insight("night_owl", 60), insight("early_bird", 55)]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("night_owl");
  });

  it("resuelve language_loyalist vs polyglot", () => {
    const result = rankInsights([insight("language_loyalist", 40), insight("polyglot", 70)]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("polyglot");
  });

  it("resuelve mono_repo_focus vs serial_starter", () => {
    const result = rankInsights([insight("mono_repo_focus", 80), insight("serial_starter", 30)]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("mono_repo_focus");
  });

  it("no descarta insights que no forman parte de ningún par excluyente", () => {
    const result = rankInsights([
      insight("night_owl", 60),
      insight("longest_streak", 90),
      insight("consistent_committer", 50)
    ]);
    expect(result.map((i) => i.type).sort()).toEqual(
      ["consistent_committer", "longest_streak", "night_owl"].sort()
    );
  });
});
