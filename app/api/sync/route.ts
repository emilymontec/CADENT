import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { inngest } from "@/lib/jobs/client";

/**
 * ⚠️ Este Route Handler NO sincroniza nada por sí mismo — solo valida la
 * sesión y encola el evento. El trabajo real ocurre en
 * lib/jobs/sync.ts, ejecutado por Inngest fuera del ciclo de vida de
 * esta request (sección 32). Esto es intencional: cualquier lógica pesada
 * aquí volvería a introducir el problema de timeout serverless.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode: "initial" | "incremental" | "full" =
    body?.mode === "full" || body?.mode === "incremental" ? body.mode : "initial";

  const syncState = await prisma.syncState.findUnique({ where: { userId: session.user.id } });
  if (syncState?.status === "RUNNING" || syncState?.status === "QUEUED") {
    return NextResponse.json({ error: "Ya hay una sincronización en curso" }, { status: 409 });
  }

  await prisma.syncState.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, status: "QUEUED" },
    update: { status: "QUEUED", progress: 0, errorMessage: null }
  });

  await inngest.send({
    name: "sync/user.requested",
    data: { userId: session.user.id, mode }
  });

  return NextResponse.json({ status: "queued" });
}

// El frontend hace polling de este endpoint para el indicador de progreso
// (sección 32: "Analyzing your GitHub... 78%").
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const syncState = await prisma.syncState.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(
    syncState ?? { status: "IDLE", progress: 0 }
  );
}
