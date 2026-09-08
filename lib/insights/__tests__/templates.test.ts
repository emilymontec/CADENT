import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/insights/templates";
import { INSIGHT_TYPES } from "@/lib/insights/types";
import type { DetectedInsight } from "@/lib/insights/types";

describe("renderTemplate", () => {
  it("tiene una plantilla para cada tipo del catálogo cerrado", () => {
    for (const type of INSIGHT_TYPES) {
      const insight: DetectedInsight = { type, priority: 1, data: {} };
      expect(() => renderTemplate(insight)).not.toThrow();
      expect(typeof renderTemplate(insight)).toBe("string");
      expect(renderTemplate(insight).length).toBeGreaterThan(0);
    }
  });

  it("nunca revienta si faltan campos esperados en data", () => {
    // data vacío a propósito, para simular un insight mal formado.
    const insight: DetectedInsight = { type: "night_owl", priority: 1, data: {} };
    expect(() => renderTemplate(insight)).not.toThrow();
  });

  it("interpola los datos reales en el texto", () => {
    const insight: DetectedInsight = {
      type: "night_owl",
      priority: 1,
      data: { nightActivityPercentage: 73 }
    };
    expect(renderTemplate(insight)).toContain("73");
  });
});
