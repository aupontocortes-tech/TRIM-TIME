import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { Barber } from "@/lib/db/types"
import { canUseBarberCommission, getUpgradeMessage } from "@/lib/plans"
import { prisma } from "@/lib/prisma"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as Partial<Pick<Barber, "name" | "phone" | "commission" | "active">>
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { role: true, isTest: true },
    })
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)

    const update: { name?: string; phone?: string | null; active?: boolean; commission?: number } = {}
    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: "Nome não pode ser vazio." }, { status: 400 })
      update.name = n
    }
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null
    if (body.active !== undefined) update.active = Boolean(body.active)

    if (body.commission !== undefined) {
      const allowed = canUseBarberCommission(plan, barbershop?.role ?? null, barbershop?.isTest ?? false)
      const c = Number(body.commission)
      if (!allowed) {
        if (c !== 0) {
          return NextResponse.json(
            { error: getUpgradeMessage("barber_commission"), code: "PLAN_FEATURE" },
            { status: 403 }
          )
        }
        update.commission = 0
      } else {
        if (!Number.isFinite(c) || c < 0 || c > 100) {
          return NextResponse.json({ error: "Comissão deve ser entre 0 e 100%." }, { status: 400 })
        }
        update.commission = c
      }
    }

    const existing = await prisma.barber.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 })

    const data = await prisma.barber.update({
      where: { id },
      data: update,
    })
    return NextResponse.json({
      id: data.id,
      barbershop_id: data.barbershopId,
      name: data.name,
      phone: data.phone,
      commission: Number(data.commission),
      active: data.active,
      role: data.role,
      created_at: data.createdAt.toISOString(),
      updated_at: data.updatedAt.toISOString(),
    } as Barber)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    await prisma.barber.deleteMany({
      where: { id, barbershopId },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
