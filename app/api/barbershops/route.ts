import { NextResponse } from "next/server"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { hashPassword } from "@/lib/auth/password"
import { withBarbershopPasswordHash } from "@/lib/barbershop-auth-settings"
import { createTrialEndDate } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"
import { toBarbershopApi } from "@/lib/prisma-barbershop"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import type { Barbershop, BarbershopSettings } from "@/lib/db/types"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
    })
    if (!barbershop) {
      return NextResponse.json(null, { status: 404 })
    }
    if (barbershop.suspendedAt) {
      return NextResponse.json(
        { error: "Conta suspensa. Entre em contato com o suporte." },
        { status: 403 }
      )
    }
    const effectivePlan = await resolveEffectivePlanForBarbershop(barbershopId)
    return NextResponse.json({
      ...toBarbershopApi(barbershop),
      effective_plan: effectivePlan,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar barbearia" },
      { status: 500 }
    )
  }
}

/** Cadastro de nova barbearia: cria barbershop + assinatura em trial (7 dias Premium). Usa Prisma para não depender do cache do Supabase. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name: string
      email: string
      phone?: string
      telefone?: string
      password?: string
    }
    if (!body.name?.trim() || !body.email?.trim() || !body.password?.trim()) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      )
    }
    if (body.password.trim().length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }
    const phone = (body.phone ?? body.telefone ?? "")?.trim() || null
    let slug = slugify(body.name)
    const existing = await prisma.barbershop.findUnique({ where: { slug } })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`
    const emailLower = body.email.trim().toLowerCase()
    const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && emailLower === process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase()
    const trialEnd = createTrialEndDate()
    const barbershop = await prisma.barbershop.create({
      data: {
        name: body.name.trim(),
        email: emailLower,
        phone,
        slug,
        role: isSuperAdmin ? "super_admin" : "admin_barbershop",
        settings: withBarbershopPasswordHash(null, hashPassword(body.password.trim())),
      },
    })
    await prisma.subscription.create({
      data: {
        barbershopId: barbershop.id,
        plan: "premium",
        status: "trial",
        trialEnd,
      },
    })
    return NextResponse.json(toBarbershopApi(barbershop))
  } catch (e) {
    console.error("[barbershops POST]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cadastrar barbearia" },
      { status: 500 }
    )
  }
}

function mergeBarbershopSettings(
  prev: Prisma.JsonValue | null | undefined,
  inc: Partial<BarbershopSettings> | undefined
): Prisma.InputJsonValue | undefined {
  if (inc === undefined) return undefined
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {}
  if (inc.address !== undefined) base.address = inc.address
  if (inc.city !== undefined) base.city = inc.city
  if (inc.state !== undefined) base.state = inc.state
  if (inc.cep !== undefined) base.cep = inc.cep
  if (inc.opening_hours !== undefined) {
    const oldH =
      base.opening_hours && typeof base.opening_hours === "object" && !Array.isArray(base.opening_hours)
        ? (base.opening_hours as Record<string, unknown>)
        : {}
    base.opening_hours = { ...oldH, ...inc.opening_hours }
  }
  return base as Prisma.InputJsonValue
}

export async function PATCH(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const body = await request.json() as Partial<
      Pick<Barbershop, "name" | "email" | "phone"> & { settings?: Partial<BarbershopSettings> }
    >
    const current = await prisma.barbershop.findUnique({ where: { id: barbershopId } })
    if (!current) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }
    const mergedSettings = mergeBarbershopSettings(current.settings, body.settings)
    const barbershop = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(mergedSettings !== undefined && { settings: mergedSettings }),
      },
    })
    const effectivePlan = await resolveEffectivePlanForBarbershop(barbershopId)
    return NextResponse.json({
      ...toBarbershopApi(barbershop),
      effective_plan: effectivePlan,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar barbearia" },
      { status: 500 }
    )
  }
}
