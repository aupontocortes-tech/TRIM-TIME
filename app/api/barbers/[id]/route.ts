import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { Barber } from "@/lib/db/types"
import { canUseBarberCommission, getUpgradeMessage } from "@/lib/plans"
import { prisma } from "@/lib/prisma"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { cpfDigits } from "@/lib/cpf"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as Partial<
      Pick<Barber, "name" | "phone" | "email" | "cpf" | "photo_url" | "commission" | "active">
    >
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { role: true, isTest: true },
    })
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)

    const update: {
      name?: string
      phone?: string | null
      email?: string | null
      cpf?: string | null
      photoUrl?: string | null
      active?: boolean
      commission?: number
    } = {}
    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: "Nome não pode ser vazio." }, { status: 400 })
      update.name = n
    }
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null
    if (body.email !== undefined) {
      const e = String(body.email).trim().toLowerCase()
      update.email = e || null
    }
    if (body.cpf !== undefined) {
      const raw = String(body.cpf).trim()
      if (!raw) update.cpf = null
      else {
        const d = cpfDigits(raw)
        if (!d) return NextResponse.json({ error: "CPF inválido (use 11 dígitos)." }, { status: 400 })
        update.cpf = d
      }
    }
    if (body.photo_url !== undefined) {
      try {
        update.photoUrl = assertValidProfilePhotoDataUrl(body.photo_url)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Foto inválida" },
          { status: 400 }
        )
      }
    }
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
      email: data.email,
      cpf: data.cpf,
      photo_url: data.photoUrl,
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
