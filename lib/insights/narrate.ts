import { prisma } from "@/lib/db/prisma";
import { renderTemplate } from "@/lib/insights/templates";
import type { DetectedInsight } from "@/lib/insights/types";

/**
 * ⚠️ Última etapa del pipeline (sección 16): "datos → Analytics Engine →
 * métricas estructuradas → Insights Engine → lenguaje natural". La IA
 * solo redacta la frase a partir de `insight.data`, que ya viene
 * calculado y verificado — nunca se le pide que calcule un porcentaje o
 * infiera un número que no esté en `data`.
 *
 * Modelo elegido: Haiku 4.5. Es una tarea de redacción de una frase corta,
 * no de razonamiento — no se justifica un modelo más caro. Verificar
 * https://docs.claude.com/en/docs/about-claude/models/overview si esto
 * se revisita más adelante.
 */
const MODEL = "claude-haiku-4-5-20251001";
const MIN_LENGTH = 20;
const MAX_LENGTH = 240;

export interface NarrateOptions {
  userId: string;
  /** Si es false, nunca llama a la API — usa la plantilla directamente. */
  useAI: boolean;
}

export interface NarrateResult {
  text: string;
  source: "AI" | "TEMPLATE";
}

function buildPrompt(insight: DetectedInsight): string {
  return [
    'Eres el redactor de "GitHub Wrapped", un reporte anual de actividad de programación al estilo Spotify Wrapped.',
    "Se te da un insight ya calculado. Los números son ciertos — no los inventes, no los cambies, no agregues otros que no estén en los datos.",
    "Redacta UNA sola frase en español, tono cercano y celebratorio, sin emojis, sin comillas, sin markdown, sin consejos, sin preguntas.",
    `Tipo de insight: ${insight.type}`,
    `Datos: ${JSON.stringify(insight.data)}`,
    "Responde ÚNICAMENTE con la frase final, nada más."
  ].join("\n");
}

/**
 * Moderación básica de salida (sección 16): si la IA devuelve algo fuera
 * de un rango de longitud esperado o con contenido que no debería
 * aparecer en una frase de una línea (markdown, links, HTML), se descarta
 * y se usa el fallback — no se muestra al usuario sin pasar este filtro.
 */
function isNarrativeValid(text: string): boolean {
  if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) return false;
  if (/```|https?:\/\/|<[a-z/][^>]*>/i.test(text)) return false;
  if (text.split("\n").length > 1) return false;
  return true;
}

interface AnthropicCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callAnthropic(prompt: string): Promise<AnthropicCallResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        temperature: 0.6,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = data.content?.find((block) => block.type === "text")?.text?.trim();
    if (!text) return null;

    return {
      text,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0
    };
  } catch {
    return null;
  }
}

/**
 * Auditoría de costo (sección 16: "controlar costo en llamadas a IA").
 * Nunca debe tirar abajo la generación de insights si el logging falla.
 */
async function logAiUsage(entry: {
  userId: string;
  inputTokens: number;
  outputTokens: number;
  succeeded: boolean;
  fallbackUsed: boolean;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: { purpose: "insight_narration", model: MODEL, ...entry }
    });
  } catch {
    // intencional: el logging de costo es best-effort
  }
}

export async function narrateInsight(
  insight: DetectedInsight,
  options: NarrateOptions
): Promise<NarrateResult> {
  const fallbackText = renderTemplate(insight);

  if (!options.useAI) {
    return { text: fallbackText, source: "TEMPLATE" };
  }

  const aiResult = await callAnthropic(buildPrompt(insight));
  const isValid = aiResult !== null && isNarrativeValid(aiResult.text);

  await logAiUsage({
    userId: options.userId,
    inputTokens: aiResult?.inputTokens ?? 0,
    outputTokens: aiResult?.outputTokens ?? 0,
    succeeded: isValid,
    fallbackUsed: !isValid
  });

  if (!isValid) {
    return { text: fallbackText, source: "TEMPLATE" };
  }

  return { text: aiResult.text, source: "AI" };
}
