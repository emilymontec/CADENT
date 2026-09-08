import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { encryptToken } from "@/lib/auth/crypto";

// ⚠️ Scopes mínimos necesarios para el MVP (sección 10 y 5): solo lectura de
// perfil y repos PÚBLICOS. `repo` (acceso a privados) queda para la fase
// opt-in posterior — no se solicita aquí.
const GITHUB_SCOPES = "read:user user:email public_repo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      authorization: { params: { scope: GITHUB_SCOPES } }
    })
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    }
  },
  events: {
    // Se dispara cuando Auth.js vincula la cuenta de GitHub tras el OAuth
    // callback. Aquí espejamos el access/refresh token — CIFRADOS — en
    // nuestro propio modelo GitHubAccount (sección 9), que es el que usa
    // el GitHubCollector para llamar a la API.
    async linkAccount({ user, account }) {
      if (account.provider !== "github") return;

      await prisma.gitHubAccount.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          accessToken: encryptToken(String(account.access_token)),
          refreshToken: account.refresh_token
            ? encryptToken(String(account.refresh_token))
            : null,
          scope: account.scope ?? GITHUB_SCOPES,
          tokenType: account.token_type ?? "bearer",
          expiresAt: account.expires_at
            ? new Date(account.expires_at * 1000)
            : null
        },
        update: {
          accessToken: encryptToken(String(account.access_token)),
          refreshToken: account.refresh_token
            ? encryptToken(String(account.refresh_token))
            : undefined,
          scope: account.scope ?? GITHUB_SCOPES,
          expiresAt: account.expires_at
            ? new Date(account.expires_at * 1000)
            : null
        }
      });

      // Inicializa el registro de sincronización (sección 12) en IDLE.
      await prisma.syncState.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {}
      });
    },
    async signIn({ user, profile }) {
      // El adapter de Prisma solo persiste los campos "estándar"
      // (name/email/image). githubId/username/avatar/timezone son propios
      // de nuestro dominio y los completamos aquí a partir del profile de
      // GitHub (ver https://docs.github.com/rest/users/users#get-a-user).
      if (!profile || !user.id) return;

      const githubProfile = profile as unknown as {
        id: number;
        login: string;
        avatar_url: string;
      };

      await prisma.user.update({
        where: { id: user.id },
        data: {
          githubId: String(githubProfile.id),
          username: githubProfile.login,
          avatar: githubProfile.avatar_url
        }
      });
    }
  },
  pages: {
    signIn: "/"
  }
});
