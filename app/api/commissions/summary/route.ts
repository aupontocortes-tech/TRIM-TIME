import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { canUseBarberCommission } from "@/lib/plans"
import { aggregateCommissionsForRange, type CommissionsSummaryResponse } from "@/lib/commissions"
import { resolveSelectedUnitId } from "@/lib/unit-context"

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    const enabled = canUseBarberCommission(plan)

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultFrom = startOfMonth.toISOString().slice(0, 10)
    const defaultTo = now.toISOString().slice(0, 10)
    let from = searchParams.get("from") ?? defaultFrom
    let to = searchParams.get("to") ?? defaultTo
    if (from > to) {
      const t = from
      from = to
      to = t
    }

    if (!enabled) {
      const empty: CommissionsSummaryResponse = {
        enabled: false,
        from,
        to,
        total: 0,
        byBarber: [],
      }
      return NextResponse.json(empty)
    }

    const scope = searchParams.get("scope")
    const unitIdForQuery =
      scope === "network" ? null : await resolveSelectedUnitId(barbershopId)
    const { total, byBarber } = await aggregateCommissionsForRange(
      barbershopId,
      from,
      to,
      unitIdForQuery
    )

    const payload: CommissionsSummaryResponse = {
      enabled: true,
      from,
      to,
      total,
      byBarber,
    }
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar comissões" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
