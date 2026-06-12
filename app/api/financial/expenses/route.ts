import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { canUseBarberCommission, getUpgradeMessage, hasFeature } from "@/lib/plans"
import { buildFinancialPnl } from "@/lib/financial-pnl-server"
import { resolveSelectedUnitId } from "@/lib/unit-context"
import {
  isShopExpenseCategory,
  ledgerEntryToExpense,
  SHOP_EXPENSE_CATEGORIES,
} from "@/lib/shop-expenses"
import { prisma } from "@/lib/prisma"

function parseYmd(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null
  return v.trim()
}

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "financial")) {
      return NextResponse.json({ error: getUpgradeMessage("financial") }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    const defaultTo = now.toISOString().slice(0, 10)
    let from = searchParams.get("from") ?? defaultFrom
    let to = searchParams.get("to") ?? defaultTo
    if (from > to) {
      const t = from
      from = to
      to = t
    }

    const scope = searchParams.get("scope")
    const unitId = scope === "network" ? null : await resolveSelectedUnitId(barbershopId)
    const commissionEnabled = canUseBarberCommission(plan)

    const payload = await buildFinancialPnl(barbershopId, from, to, unitId, commissionEnabled)
    return NextResponse.json({
      ...payload,
      categories: SHOP_EXPENSE_CATEGORIES,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar P&L" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "financial")) {
      return NextResponse.json({ error: getUpgradeMessage("financial") }, { status: 403 })
    }

    const body = (await request.json()) as {
      category?: string
      amount?: number
      note?: string
      vendor?: string
      occurred_at?: string
    }

    const category = body.category?.trim() ?? ""
    if (!isShopExpenseCategory(category)) {
      return NextResponse.json({ error: "Categoria inválida." }, { status: 400 })
    }

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 })
    }

    const occurredYmd = body.occurred_at ? parseYmd(body.occurred_at) : null
    if (body.occurred_at && !occurredYmd) {
      return NextResponse.json({ error: "Data inválida (use AAAA-MM-DD)." }, { status: 400 })
    }

    const scopeUnit = await resolveSelectedUnitId(barbershopId)
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null
    const vendor = typeof body.vendor === "string" ? body.vendor.trim().slice(0, 200) : null

    const occurredAt = occurredYmd
      ? new Date(`${occurredYmd}T12:00:00.000Z`)
      : new Date()

    const created = await prisma.financialLedgerEntry.create({
      data: {
        barbershopId,
        unitId: scopeUnit,
        direction: "out",
        category,
        amount,
        note: note || SHOP_EXPENSE_CATEGORIES[category],
        vendor,
        occurredAt,
      },
      include: { unit: { select: { name: true } } },
    })

    return NextResponse.json(ledgerEntryToExpense(created))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao registrar despesa" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
