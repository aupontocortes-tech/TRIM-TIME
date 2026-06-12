import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { getUpgradeMessage, hasFeature } from "@/lib/plans"
import { isShopExpenseCategory, ledgerEntryToExpense } from "@/lib/shop-expenses"
import {
  deleteFinancialLedgerExpense,
  updateFinancialLedgerExpense,
} from "@/lib/db/financial-ledger-store"

type RouteCtx = { params: Promise<{ id: string }> }

function parseYmd(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null
  return v.trim()
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "financial")) {
      return NextResponse.json({ error: getUpgradeMessage("financial") }, { status: 403 })
    }

    const { id } = await ctx.params
    const deleted = await deleteFinancialLedgerExpense(id, barbershopId)
    if (!deleted) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir despesa" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "financial")) {
      return NextResponse.json({ error: getUpgradeMessage("financial") }, { status: 403 })
    }

    const { id } = await ctx.params

    const body = (await request.json()) as {
      category?: string
      amount?: number
      name?: string
      note?: string
      vendor?: string
      occurred_at?: string
    }

    const data: {
      category?: string
      amount?: number
      note?: string | null
      vendor?: string | null
      occurredAt?: Date
    } = {}

    if (body.category !== undefined) {
      if (!isShopExpenseCategory(body.category)) {
        return NextResponse.json({ error: "Categoria inválida." }, { status: 400 })
      }
      data.category = body.category
    }

    if (body.amount !== undefined) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Valor inválido." }, { status: 400 })
      }
      data.amount = amount
    }

    if (body.name !== undefined || body.note !== undefined) {
      const nameRaw =
        typeof body.name === "string"
          ? body.name.trim()
          : typeof body.note === "string"
            ? body.note.trim()
            : ""
      if (!nameRaw) {
        return NextResponse.json({ error: "Informe o nome da despesa." }, { status: 400 })
      }
      data.note = nameRaw.slice(0, 500)
    }

    if (body.vendor !== undefined) {
      data.vendor = typeof body.vendor === "string" ? body.vendor.trim().slice(0, 200) : null
    }

    if (body.occurred_at !== undefined) {
      const ymd = parseYmd(body.occurred_at)
      if (!ymd) {
        return NextResponse.json({ error: "Data inválida." }, { status: 400 })
      }
      data.occurredAt = new Date(`${ymd}T12:00:00.000Z`)
    }

    const updated = await updateFinancialLedgerExpense(id, barbershopId, data)
    if (!updated) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 })
    }

    return NextResponse.json(ledgerEntryToExpense(updated))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar despesa" },
      { status: 500 }
    )
  }
}
