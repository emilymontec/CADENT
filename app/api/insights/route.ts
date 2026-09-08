import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getInsightsForUser } from "@/lib/insights/service";

/**
 * Igual que /api/analytics: delgado, delega a lib/insights/service.ts.
 * Sin parámetro de período — los insights siempre son del período
 * canónico "rolling12" (ver comentario en el servicio).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const insights = await getInsightsForUser(session.user.id);
  return NextResponse.json({ insights });
}
