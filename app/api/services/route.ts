import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import type { Service } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const data = await prisma.service.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(
      data.map((s) => ({
        id: s.id,
        barbershop_id: s.barbershopId,
        name: s.name,
        price: Number(s.price),
        duration: s.duration,
        active: s.active,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      })) as Service[]
    )
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
      return NextResponse.json(
        { error: getUpgradeMessage("services_prices") },
        { status: 403 }
      )
    }
    const body = await request.json() as { name: string; price: number; duration?: number }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const price = Number(body.price)
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 })
    }
    const data = await prisma.service.create({
      data: {
        barbershopId,
        name: body.name.trim(),
        price,
        duration: Math.max(1, Number(body.duration) || 30),
        active: true,
      },
    })
    return NextResponse.json({
      id: data.id,
      barbershop_id: data.barbershopId,
      name: data.name,
      price: Number(data.price),
      duration: data.duration,
      active: data.active,
      created_at: data.createdAt.toISOString(),
      updated_at: data.updatedAt.toISOString(),
    } as Service)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar serviço" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
