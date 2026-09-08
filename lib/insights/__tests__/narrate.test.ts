import { afterEach, describe, expect, it, vi } from "vitest";

// narrate.ts importa el singleton de Prisma para loguear costo de IA.
// Se mockea ANTES de importar narrate.ts para que nunca se instancie un
// PrismaClient real (que requeriría "prisma generate" corrido contra una
// DB real, algo que estos tests no deberían necesitar).
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aiUsageLog: {
      create: vi.fn().mockResolvedValue(undefined)
    }
  }
}));

import { narrateInsight } from "@/lib/insights/narrate";
import { prisma } from "@/lib/db/prisma";
import type { DetectedInsight } from "@/lib/insights/types";

const nightOwlInsight: DetectedInsight = {
  type: "night_owl",
  priority: 60,
  data: { nightActivityPercentage: 65 }
};

describe("narrateInsight", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    vi.clearAllMocks();
  });

  it("usa la plantilla directamente cuando useAI es false, sin llamar a fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: false });

    expect(result.source).toBe("TEMPLATE");
    expect(result.text).toContain("65");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cae a la plantilla si no hay ANTHROPIC_API_KEY configurada, aunque useAI sea true", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: true });

    expect(result.source).toBe("TEMPLATE");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("usa la respuesta de la IA cuando es válida", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Programas de noche como un búho digital, sin descanso." }],
        usage: { input_tokens: 120, output_tokens: 18 }
      })
    }) as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: true });

    expect(result.source).toBe("AI");
    expect(result.text).toBe("Programas de noche como un búho digital, sin descanso.");
    expect(prisma.aiUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ succeeded: true, fallbackUsed: false })
      })
    );
  });

  it("cae a la plantilla si la respuesta de la IA es demasiado corta (moderación)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Muy corto." }],
        usage: { input_tokens: 100, output_tokens: 3 }
      })
    }) as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: true });

    expect(result.source).toBe("TEMPLATE");
    expect(prisma.aiUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ succeeded: false, fallbackUsed: true })
      })
    );
  });

  it("cae a la plantilla si la respuesta de la IA contiene markdown/links (moderación)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: "Mira más en https://example.com sobre tus commits nocturnos, impresionante racha."
          }
        ],
        usage: { input_tokens: 100, output_tokens: 20 }
      })
    }) as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: true });
    expect(result.source).toBe("TEMPLATE");
  });

  it("cae a la plantilla si la llamada a la API falla (network error)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: true });
    expect(result.source).toBe("TEMPLATE");
  });

  it("cae a la plantilla si la API responde con un status no-OK", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const result = await narrateInsight(nightOwlInsight, { userId: "u1", useAI: true });
    expect(result.source).toBe("TEMPLATE");
  });

  it("nunca deja caer el flujo si el logging de costo falla", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Programas de noche como un búho digital, sin descanso." }],
        usage: { input_tokens: 120, output_tokens: 18 }
      })
    }) as unknown as typeof fetch;
    (prisma.aiUsageLog.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down")
    );

    await expect(
      narrateInsight(nightOwlInsight, { userId: "u1", useAI: true })
    ).resolves.toMatchObject({ source: "AI" });
  });
});
