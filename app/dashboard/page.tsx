import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getAnalyticsForUser } from "@/lib/analytics/service";
import { getInsightsForUser } from "@/lib/insights/service";
import { SyncPanel } from "@/app/dashboard/sync-panel";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type { PersistedInsight } from "@/lib/insights/types";

const DEFAULT_PERIOD = "last30" as const;

export default async function DashboardPage() {
  // ⚠️ La protección de esta ruta vive aquí, no en middleware.ts (no
  // existe). Este proyecto usa `session: { strategy: "database" }` +
  // Prisma adapter + cifrado de tokens con `node:crypto` (lib/auth/crypto.ts)
  // — ninguno de los dos corre en el Edge Runtime, que es donde Next.js
  // ejecuta middleware.ts por defecto. Un middleware que reexportara
  // `auth` desde lib/auth/index.ts fallaría en build/runtime (se detectó
  // exactamente este error al compilar). El check de sesión en un Server
  // Component corre en Node.js, así que aquí sí es seguro.
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const userId = session.user.id;

  const syncState = await prisma.syncState.findUnique({ where: { userId } });
  const neverSynced = !syncState || syncState.status === "IDLE";

  // El render inicial usa el mismo servicio que /api/analytics — nunca
  // duplica la lógica de armar el rango de fechas o correr el Analytics
  // Engine (sección 13).
  const [analytics, insights] = neverSynced
    ? [null, []]
    : await Promise.all([
        getAnalyticsForUser(userId, DEFAULT_PERIOD),
        getInsightsForUser(userId)
      ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">GitHub Wrapped</h1>
          <p className="text-neutral-400">Hola, {session.user.name ?? "developer"}</p>
        </div>
      </header>

      <div className="mb-8">
        <SyncPanel />
      </div>

      {neverSynced || !analytics ? (
        <EmptyState
          title="Todavía no hay datos"
          description="Sincroniza tu cuenta de GitHub arriba para ver tu actividad, lenguajes y rachas."
        />
      ) : (
        <DashboardClient
          initialPeriod={DEFAULT_PERIOD}
          initialData={{ analytics, insights: insights as PersistedInsight[] }}
        />
      )}
    </main>
  );
}
