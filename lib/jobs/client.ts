import { Inngest, EventSchemas } from "inngest";

/**
 * ⚠️ Corrección crítica (sección 32): Next.js/Vercel Route Handlers tienen
 * límites de tiempo de ejecución (10-60s según plan). Sincronizar un
 * usuario con decenas de miles de commits no cabe ahí. Todo el trabajo
 * pesado de sincronización va a través de este job queue (Inngest), nunca
 * directamente en un Route Handler.
 */

type Events = {
  "sync/user.requested": {
    data: { userId: string; mode: "initial" | "incremental" | "full" };
  };
  "insights/generate.requested": {
    data: { userId: string; periodStart: string; periodEnd: string };
  };
};

export const inngest = new Inngest({
  id: "github-wrapped",
  schemas: new EventSchemas().fromRecord<Events>()
});
