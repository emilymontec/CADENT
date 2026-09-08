import { GraphQLClient, gql } from "graphql-request";
import { decryptToken } from "@/lib/auth/crypto";
import { withRetry } from "@/lib/github/client";

/**
 * ⚠️ Corrección crítica (sección 6): el contribution calendar (el "mapa de
 * calor" de actividad) NO existe como endpoint en la API REST de GitHub.
 * Solo está disponible vía GraphQL, en `user.contributionsCollection`.
 *
 * GraphQL usa su propio sistema de rate limit (puntos por complejidad de
 * query), completamente separado del límite de 5,000 req/hora de REST.
 * No asumir que ambos comparten presupuesto.
 */

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

export function createGitHubGraphQLClient(encryptedAccessToken: string): GraphQLClient {
  const accessToken = decryptToken(encryptedAccessToken);
  return new GraphQLClient(GITHUB_GRAPHQL_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

export interface ContributionDay {
  date: string; // YYYY-MM-DD, tal como lo entrega GitHub (calculado por GitHub en UTC)
  contributionCount: number;
}

interface ContributionCalendarResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number;
        weeks: { contributionDays: ContributionDay[] }[];
      };
    };
  };
  rateLimit: { cost: number; remaining: number; resetAt: string };
}

const CONTRIBUTION_CALENDAR_QUERY = gql`
  query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
    rateLimit {
      cost
      remaining
      resetAt
    }
  }
`;

export async function getContributionCalendar(
  client: GraphQLClient,
  params: { login: string; from: Date; to: Date }
): Promise<{ totalContributions: number; days: ContributionDay[]; rateLimitRemaining: number }> {
  const data = await withRetry(() =>
    client.request<ContributionCalendarResponse>(CONTRIBUTION_CALENDAR_QUERY, {
      login: params.login,
      from: params.from.toISOString(),
      to: params.to.toISOString()
    })
  );

  const calendar = data.user.contributionsCollection.contributionCalendar;
  return {
    totalContributions: calendar.totalContributions,
    days: calendar.weeks.flatMap((w) => w.contributionDays),
    rateLimitRemaining: data.rateLimit.remaining
  };
}
