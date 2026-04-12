import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prismaServiceCreateWithDescription } from "@/lib/service-mutations"
import { fetchServiceByIdRaw, fetchServicesForBarbershopRaw, serviceDbRowToApi } from "@/lib/service-queries"
import type { Service } from "@/lib/db/types"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    const rows = await fetchServicesForBarbershopRaw(barbershopId, { orderBy: "name" })
    return NextResponse.json(rows.map(serviceDbRowToApi) as Service[])
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
    const body = await request.json() as { name: string; price: number; duration?: number; description?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const price = Number(body.price)
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido" }, { status: 400 })
    }
    const desc =
      typeof body.description === "string" ? body.description.trim().slice(0, 2000) : ""
    const data = await prismaServiceCreateWithDescription({
      barbershopId,
      name: body.name.trim(),
      description: desc,
      price,
      duration: Math.max(1, Number(body.duration) || 30),
      active: true,
    })
    const row = (await fetchServiceByIdRaw(data.id)) ?? null
    const payload = row
      ? serviceDbRowToApi(row)
      : {
          id: data.id,
          barbershop_id: data.barbershopId,
          name: data.name,
          description: desc,
          price: Number(data.price),
          duration: data.duration,
          active: data.active,
          created_at: data.createdAt.toISOString(),
          updated_at: data.updatedAt.toISOString(),
        }
    return NextResponse.json(payload as Service)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar serviço" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
