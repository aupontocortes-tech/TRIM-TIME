import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { canAddBarber, canUseBarberCommission, getBarberLimitMessage, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { prisma } from "@/lib/prisma"
import { prismaBarberCreateWithPhotoPositionFallback } from "@/lib/barber-mutations"
import { fetchBarberPhotoPositionsByBarbershopId } from "@/lib/barber-queries"
import type { Barber } from "@/lib/db/types"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"

export async function GET() {
  try {
    const barbershopId = await requireBarbershopId()
    let data = await prisma.barber.findMany({
      where: { barbershopId },
      orderBy: { name: "asc" },
    })
    const missingPortal = data.filter((b) => !b.portalToken)
    if (missingPortal.length > 0) {
      await Promise.all(
        missingPortal.map((b) =>
          prisma.barber.update({ where: { id: b.id }, data: { portalToken: randomUUID() } })
        )
      )
      data = await prisma.barber.findMany({
        where: { barbershopId },
        orderBy: { name: "asc" },
      })
    }
    let positions = new Map<string, number>()
    try {
      positions = await fetchBarberPhotoPositionsByBarbershopId(barbershopId)
    } catch {
      /* coluna/tabela inacessível via SQL: usa só o Prisma */
    }
    return NextResponse.json(
      data.map((b) => {
        const pt = b.portalToken ?? null
        return {
          id: b.id,
          barbershop_id: b.barbershopId,
          name: b.name,
          phone: b.phone,
          email: b.email,
          cpf: b.cpf,
          photo_url: b.photoUrl,
          photo_position: positions.get(b.id) ?? (b as { photoPosition?: number }).photoPosition ?? 50,
          commission: Number(b.commission),
          active: b.active,
          role: b.role,
          portal_token: pt,
          app_profissional_path: pt ? `/profissional/${pt}` : null,
          created_at: b.createdAt.toISOString(),
          updated_at: b.updatedAt.toISOString(),
        }
      }) as Barber[]
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
    const [plan, currentCount] = await Promise.all([
      resolveEffectivePlanForActiveSession(barbershopId),
      prisma.barber.count({ where: { barbershopId } }),
    ])
    if (!plan) {
      return NextResponse.json(
        { error: "Assinatura não ativa. Escolha um plano." },
        { status: 403 }
      )
    }
    if (!canAddBarber(plan, currentCount)) {
      return NextResponse.json(
        { error: getBarberLimitMessage(plan), code: "PLAN_LIMIT" },
        { status: 403 }
      )
    }

    const body = await request.json() as {
      name: string
      phone?: string
      email?: string
      cpf?: string
      photo_url?: string | null
      photo_position?: number
      commission?: number
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }
    const phoneTrim = String(body.phone ?? "").trim()
    if (!phoneTrim) {
      return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 })
    }

    let photoUrl: string | null = null
    try {
      photoUrl = assertValidProfilePhotoDataUrl(body.photo_url ?? null)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Foto inválida" },
        { status: 400 }
      )
    }
    const cpfDigitsOnly = String(body.cpf ?? "").replace(/\D/g, "")
    const cpfNorm: string | null = cpfDigitsOnly.length >= 11 ? cpfDigitsOnly.slice(0, 11) : null
    const emailTrim = body.email?.trim().toLowerCase() || null

    const commissionAllowed = canUseBarberCommission(plan)
    let commission = body.commission ?? 0
    if (!commissionAllowed) {
      if (body.commission != null && Number(body.commission) !== 0) {
        return NextResponse.json(
          { error: getUpgradeMessage("barber_commission"), code: "PLAN_FEATURE" },
          { status: 403 }
        )
      }
      commission = 0
    } else {
      const c = Number(commission)
      if (!Number.isFinite(c) || c < 0 || c > 100) {
        return NextResponse.json({ error: "Comissão deve ser entre 0 e 100%." }, { status: 400 })
      }
      commission = c
    }

    const photoPosition = Math.min(100, Math.max(0, Math.round(Number(body.photo_position ?? 50))))
    const data = await prismaBarberCreateWithPhotoPositionFallback({
      barbershopId,
      name: body.name.trim(),
      phone: phoneTrim,
      email: emailTrim,
      cpf: cpfNorm,
      photoUrl,
      photoPosition,
      commission,
      active: true,
      portalToken: randomUUID(),
    })
    const pt = data.portalToken ?? null
    return NextResponse.json({
      id: data.id,
      barbershop_id: data.barbershopId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      cpf: data.cpf,
      photo_url: data.photoUrl,
      photo_position: data.photoPosition ?? 50,
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
      { error: e instanceof Error ? e.message : "Erro ao criar barbeiro" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
