import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { getUpgradeMessage, hasFeature } from "@/lib/plans"
import { isShopExpenseCategory, ledgerEntryToExpense, SHOP_EXPENSE_CATEGORIES } from "@/lib/shop-expenses"
import { prisma } from "@/lib/prisma"

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
    const row = await prisma.financialLedgerEntry.findFirst({
      where: { id, barbershopId },
    })
    if (!row) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 })
    }

    await prisma.financialLedgerEntry.delete({ where: { id } })
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
    const existing = await prisma.financialLedgerEntry.findFirst({
      where: { id, barbershopId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 })
    }

    const body = (await request.json()) as {
      category?: string
      amount?: number
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

    if (body.note !== undefined) {
      data.note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null
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

    const updated = await prisma.financialLedgerEntry.update({
      where: { id },
      data,
      include: { unit: { select: { name: true } } },
    })

    return NextResponse.json(ledgerEntryToExpense(updated))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar despesa" },
      { status: 500 }
    )
  }
}
