import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { getUpgradeMessage, hasFeature } from "@/lib/plans"
import { buildFinancialSummary } from "@/lib/financial-summary-server"

/** Faturamento somado de todas as unidades (ignora unidade ativa no cookie). */
export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "financial")) {
      return NextResponse.json({ error: getUpgradeMessage("financial") }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    let from = searchParams.get("from")
    let to = searchParams.get("to")
    const today = searchParams.get("today")

    if (!from || !to) {
      return NextResponse.json({ error: "Informe from e to (YYYY-MM-DD)." }, { status: 400 })
    }
    if (from > to) {
      const s = from
      from = to
      to = s
    }

    const payload = await buildFinancialSummary(barbershopId, from, to, today, null)
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar resumo da rede" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
