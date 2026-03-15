import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getRealBarbershopIdFromRequest } from "@/lib/tenant"

/** Apenas role=admin. Retorna totais para o dashboard do super admin. */
export async function GET() {
  try {
    const barbershopId = await getRealBarbershopIdFromRequest()
    if (!barbershopId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const supabase = createServiceRoleClient()
    const { data: me } = await supabase
      .from("barbershops")
      .select("role")
      .eq("id", barbershopId)
      .single()
    if (me?.role !== "admin") return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

    const [countBarbershops, countSubscriptions] = await Promise.all([
      supabase.from("barbershops").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["trial", "active"]),
    ])
    const totalBarbershops = countBarbershops.count ?? 0
    const totalAssinaturasAtivas = countSubscriptions.count ?? 0
    return NextResponse.json({
      totalBarbershops,
      totalUsuarios: totalBarbershops,
      totalAssinaturasAtivas,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
