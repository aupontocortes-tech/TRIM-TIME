import { NextResponse } from "next/server"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { createTrialEndDate } from "@/lib/subscription"
import { prisma } from "@/lib/prisma"
import { toBarbershopApi } from "@/lib/prisma-barbershop"
import type { Barbershop } from "@/lib/db/types"

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
    return NextResponse.json(toBarbershopApi(barbershop))
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
    const body = await request.json() as { name: string; email: string; phone?: string; telefone?: string }
    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json(
        { error: "Nome e email são obrigatórios" },
        { status: 400 }
      )
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

export async function PATCH(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const body = await request.json() as Partial<Pick<Barbershop, "name" | "email" | "phone">>
    const barbershop = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
      },
    })
    return NextResponse.json(toBarbershopApi(barbershop))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar barbearia" },
      { status: 500 }
    )
  }
}
