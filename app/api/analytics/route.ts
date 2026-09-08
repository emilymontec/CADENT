import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAnalyticsForUser } from "@/lib/analytics/service";
import { isPeriodOption } from "@/lib/dashboard/period";

/**
 * Route Handler deliberadamente "delgado" (sección 13): solo valida
 * sesión + parámetro y delega todo a lib/analytics/service.ts, que es la
 * misma función que usa el Server Component del dashboard para su render
 * inicial — un solo lugar calcula el rango de fechas para cada período.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const period = new URL(request.url).searchParams.get("period");
  if (!isPeriodOption(period)) {
    return NextResponse.json(
      { error: "period inválido. Usa: last30, calendarYear o rolling12." },
      { status: 400 }
    );
  }

  const result = await getAnalyticsForUser(session.user.id, period);
  return NextResponse.json(result);
}
