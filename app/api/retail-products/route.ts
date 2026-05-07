import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import type { RetailProduct } from "@/lib/db/types"

function rowToApi(r: {
  id: string
  barbershopId: string
  name: string
  description: string
  price: unknown
  active: boolean
  createdAt: Date
  updatedAt: Date
}): RetailProduct {
  return {
    id: r.id,
    barbershop_id: r.barbershopId,
    name: r.name,
    description: (r.description ?? "").trim(),
    price: Number(r.price),
    active: r.active,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const rows = await prisma.retailProduct.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows.map(rowToApi) as RetailProduct[])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "services_prices")) {
      return NextResponse.json({ error: getUpgradeMessage("services_prices") }, { status: 403 })
    }
    const body = (await request.json()) as { name?: string; price?: number; description?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const price = Number(body.price)
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 })
    }
    const desc = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : ""
    const created = await prisma.retailProduct.create({
      data: {
        barbershopId,
        name: body.name.trim(),
        description: desc,
        price,
        active: true,
      },
    })
    return NextResponse.json(rowToApi(created) as RetailProduct)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar produto" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
