import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { Barber } from "@/lib/db/types"
import { canUseBarberCommission, getUpgradeMessage } from "@/lib/plans"
import { prisma } from "@/lib/prisma"
import { prismaBarberUpdateWithPhotoPositionFallback } from "@/lib/barber-mutations"
import { fetchBarberPhotoPositionById, fetchBarberPhotoScaleById } from "@/lib/barber-queries"
import { clampPhotoPosition, clampPhotoScale } from "@/lib/barber-photo-style"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { withBarbersUnitSchema } from "@/lib/barber-unit-schema"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as Partial<
      Pick<Barber, "name" | "phone" | "email" | "cpf" | "photo_url" | "photo_position" | "photo_scale" | "commission" | "active">
    > & { unit_id?: string | null }
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
      photoPosition?: number
      photoScale?: number
      active?: boolean
      commission?: number
      unitId?: string | null
    } = {}
    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: "Nome não pode ser vazio." }, { status: 400 })
      update.name = n
    }
    if (body.phone !== undefined) {
      const p = body.phone?.trim() || null
      if (!p) {
        return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 })
      }
      update.phone = p
    }
    if (body.email !== undefined) {
      if (body.email === null) update.email = null
      else {
        const e = String(body.email).trim().toLowerCase()
        update.email = e || null
      }
    }
    if (body.cpf !== undefined) {
      if (body.cpf === null) {
        update.cpf = null
      } else {
        const digitsOnly = String(body.cpf).replace(/\D/g, "")
        update.cpf = digitsOnly.length >= 11 ? digitsOnly.slice(0, 11) : null
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
    if (body.photo_position !== undefined) {
      update.photoPosition = clampPhotoPosition(Number(body.photo_position ?? 50))
    }
    if (body.photo_scale !== undefined) {
      update.photoScale = clampPhotoScale(Number(body.photo_scale ?? 100))
    }

    if (body.unit_id !== undefined) {
      if (body.unit_id === null || body.unit_id === "") {
        update.unitId = null
      } else {
        const unit = await prisma.barbershopUnit.findFirst({
          where: { id: body.unit_id.trim(), barbershopId, active: true },
          select: { id: true },
        })
        if (!unit) {
          return NextResponse.json({ error: "Unidade inválida" }, { status: 400 })
        }
        update.unitId = unit.id
      }
    }

    if (body.commission !== undefined) {
      const allowed = canUseBarberCommission(plan)
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
      select: { id: true, portalToken: true },
    })
    if (!existing) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 })

    if (!existing.portalToken) {
      await prisma.barber.update({
        where: { id },
        data: { portalToken: randomUUID() },
      })
    }

    const data = await withBarbersUnitSchema(() => prismaBarberUpdateWithPhotoPositionFallback(id, update))
    let photoPositionFromDb: number | null = null
    let photoScaleFromDb: number | null = null
    try {
      photoPositionFromDb = await fetchBarberPhotoPositionById(id)
      photoScaleFromDb = await fetchBarberPhotoScaleById(id)
    } catch {
      /* leitura SQL opcional; resposta usa body ou Prisma */
    }
    const photoPositionResponse =
      photoPositionFromDb ??
      (body.photo_position !== undefined
        ? clampPhotoPosition(Number(body.photo_position))
        : (data as { photoPosition?: number }).photoPosition ?? 50)
    const photoScaleResponse =
      photoScaleFromDb ??
      (body.photo_scale !== undefined
        ? clampPhotoScale(Number(body.photo_scale))
        : (data as { photoScale?: number }).photoScale ?? 100)
    const refreshed = await prisma.barber.findFirst({
      where: { id, barbershopId },
      select: { portalToken: true },
    })
    const pt = refreshed?.portalToken ?? null
    return NextResponse.json({
      id: data.id,
      barbershop_id: data.barbershopId,
      unit_id: data.unitId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      cpf: data.cpf,
      photo_url: data.photoUrl,
      photo_position: photoPositionResponse,
      photo_scale: photoScaleResponse,
      commission: Number(data.commission),
      active: data.active,
      role: data.role,
      portal_token: pt,
      app_profissional_path: pt ? `/profissional/${pt}` : null,
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
