import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canAddBarber, canUseBarberCommission, getBarberLimitMessage } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { cpfDigits } from "@/lib/cpf"
import type { Barber } from "@/lib/db/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const t = String(token ?? "").trim()
    if (t.length < 32) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }

    const invite = await prisma.barberInvite.findUnique({
      where: { token: t },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        barbershop: { select: { name: true, slug: true, suspendedAt: true } },
      },
    })

    if (!invite || invite.barbershop.suspendedAt) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 })
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: "Este link já foi utilizado" }, { status: 410 })
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Este link expirou" }, { status: 410 })
    }

    return NextResponse.json({
      ok: true,
      barbershop_name: invite.barbershop.name,
      slug: invite.barbershop.slug,
      expires_at: invite.expiresAt.toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar convite" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const t = String(token ?? "").trim()
    if (t.length < 32) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      email?: string
      phone?: string
      cpf?: string
      photo_url?: string | null
    }

    const name = String(body.name ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const phone = String(body.phone ?? "").trim()
    const cpfRaw = String(body.cpf ?? "").trim()

    if (!name) {
      return NextResponse.json({ error: "Informe o nome completo" }, { status: 400 })
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 })
    }
    const phoneDigits = phone.replace(/\D/g, "")
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: "Informe um telefone com DDD" }, { status: 400 })
    }
    const cpfNorm = cpfDigits(cpfRaw)
    if (!cpfNorm) {
      return NextResponse.json({ error: "CPF inválido (11 dígitos)" }, { status: 400 })
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
    if (!photoUrl) {
      return NextResponse.json({ error: "Envie uma foto de perfil" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.barberInvite.findUnique({
        where: { token: t },
        select: {
          id: true,
          barbershopId: true,
          expiresAt: true,
          usedAt: true,
          barbershop: {
            select: { suspendedAt: true, role: true, isTest: true },
          },
        },
      })

      if (!invite || invite.barbershop.suspendedAt) {
        return { ok: false as const, error: "Convite não encontrado", status: 404 }
      }
      if (invite.usedAt) {
        return { ok: false as const, error: "Este link já foi utilizado", status: 410 }
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        return { ok: false as const, error: "Este link expirou", status: 410 }
      }

      const barbershopId = invite.barbershopId
      const plan = await resolveEffectivePlanForBarbershop(barbershopId)
      if (!plan) {
        return {
          ok: false,
          error: "Barbearia sem plano ativo. Avise o responsável.",
          status: 403,
        }
      }

      const count = await tx.barber.count({ where: { barbershopId } })
      if (!canAddBarber(plan, count)) {
        return {
          ok: false,
          error: getBarberLimitMessage(plan),
          code: "PLAN_LIMIT",
          status: 403,
        }
      }

      const commissionAllowed = canUseBarberCommission(
        plan,
        invite.barbershop.role,
        invite.barbershop.isTest
      )
      const commission = commissionAllowed ? 50 : 0

      const barber = await tx.barber.create({
        data: {
          barbershopId,
          name,
          phone: phone || null,
          email,
          cpf: cpfNorm,
          photoUrl,
          commission,
          active: true,
          role: "user",
        },
      })

      await tx.barberInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      })

      return { ok: true as const, barber }
    })

    if (!result.ok) {
      const payload: { error: string; code?: string } = { error: result.error }
      if (result.code) payload.code = result.code
      return NextResponse.json(payload, { status: result.status })
    }

    const b = result.ok ? result.barber : undefined
    if (!b) {
      return NextResponse.json({ error: "Erro ao concluir cadastro" }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      barber: {
        id: b.id,
        barbershop_id: b.barbershopId,
        name: b.name,
        phone: b.phone,
        email: b.email,
        cpf: b.cpf,
        photo_url: b.photoUrl,
        commission: Number(b.commission),
        active: b.active,
        role: b.role,
        created_at: b.createdAt.toISOString(),
        updated_at: b.updatedAt.toISOString(),
      } as Barber,
    })
  } catch (e) {
    console.error("[public/barber-invite POST]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar cadastro" },
      { status: 500 }
    )
  }
}
