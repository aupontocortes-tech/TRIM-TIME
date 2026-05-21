import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getInfrastructureUsage } from "@/lib/infrastructure-usage"

export const dynamic = "force-dynamic"

/** Uso da infraestrutura (limites FREE) — apenas super_admin. */
export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const data = await getInfrastructureUsage()
    return NextResponse.json(data)
  } catch (e) {
    console.error("[admin/infrastructure-usage]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar métricas" },
      { status: 500 }
    )
  }
}
