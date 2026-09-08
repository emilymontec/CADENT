import { Octokit } from "@octokit/rest";
import { decryptToken } from "@/lib/auth/crypto";

/**
 * Cliente REST de GitHub para el GitHubCollector (sección 11).
 *
 * Cubre: usuarios, repos, commits por repo, lenguajes por repo.
 * El contribution calendar NO está aquí — ver lib/github/graphql.ts,
 * porque ese dato no existe en REST (sección 6).
 *
 * Rate limit REST: 5,000 req/hora por usuario autenticado. Distinto e
 * independiente del límite por puntos de GraphQL.
 */

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envuelve cualquier llamada a Octokit con retry + backoff exponencial
 * ante 403 (rate limit / abuse detection) y 429 (too many requests).
 * ⚠️ Corrección sección 11: el plan original solo "manejaba" el error una
 * vez; esto reintenta con backoff hasta MAX_RETRIES.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    const isRateLimited = status === 403 || status === 429;

    if (!isRateLimited || attempt >= MAX_RETRIES) {
      throw error;
    }

    // Si GitHub nos dice cuándo reintentar (retry-after o x-ratelimit-reset),
    // respétalo; si no, backoff exponencial con jitter.
    const headers = (error as { response?: { headers?: Record<string, string> } })?.response
      ?.headers;
    const retryAfterSeconds = headers?.["retry-after"]
      ? Number(headers["retry-after"])
      : undefined;

    const delayMs =
      retryAfterSeconds !== undefined
        ? retryAfterSeconds * 1000
        : BASE_DELAY_MS * 2 ** attempt + Math.random() * 250;

    await sleep(delayMs);
    return withRetry(fn, attempt + 1);
  }
}

export function createGitHubClient(encryptedAccessToken: string): Octokit {
  const accessToken = decryptToken(encryptedAccessToken);
  return new Octokit({ auth: accessToken });
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  avatarUrl: string;
  name: string | null;
  email: string | null;
}

export async function getAuthenticatedUser(client: Octokit): Promise<GitHubUserProfile> {
  const { data } = await withRetry(() => client.rest.users.getAuthenticated());
  return {
    id: data.id,
    login: data.login,
    avatarUrl: data.avatar_url,
    name: data.name,
    email: data.email
  };
}

/**
 * Emails verificados de la cuenta autenticada. Usado para resolver la
 * identidad real del autor de un commit (sección 11), en vez de confiar
 * únicamente en author.login (que puede venir vacío si el commit no quedó
 * vinculado automáticamente a la cuenta de GitHub).
 */
export async function getVerifiedEmails(client: Octokit): Promise<string[]> {
  const { data } = await withRetry(() => client.rest.users.listEmailsForAuthenticatedUser());
  return data.filter((e) => e.verified).map((e) => e.email);
}

export { Octokit };
