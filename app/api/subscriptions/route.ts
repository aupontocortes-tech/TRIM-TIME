import { NextResponse } from "next/server"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { Subscription } from "@/lib/db/types"

function toSubscriptionApi(sub: {
  id: string
  barbershopId: string
  plan: string
  status: string
  trialEnd: Date | null
  nextPayment: Date | null
  createdAt: Date
  updatedAt: Date
}): Subscription {
  return {
    id: sub.id,
    barbershop_id: sub.barbershopId,
    plan: sub.plan as Subscription["plan"],
    status: sub.status as Subscription["status"],
    trial_end: sub.trialEnd?.toISOString() ?? null,
    next_payment: sub.nextPayment?.toISOString() ?? null,
    created_at: sub.createdAt.toISOString(),
    updated_at: sub.updatedAt.toISOString(),
  }
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
    const data = await prisma.subscription.findUnique({
      where: { barbershopId },
    })
    if (!data) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(toSubscriptionApi(data))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao buscar assinatura" },
      { status: 500 }
    )
  }
}

/** Escolher plano (após trial ou nova assinatura) */
export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json(
        { error: "Barbershop não identificada" },
        { status: 401 }
      )
    }
    const body = await request.json() as { plan: Subscription["plan"] }
    const plan = body.plan
    if (!plan || !["basic", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
    }
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { id: true },
    })
    if (!barbershop) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })

    const nextPayment = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const data = await prisma.subscription.upsert({
      where: { barbershopId },
      update: {
        plan,
        status: "active",
        trialEnd: null,
        nextPayment,
      },
      create: {
        barbershopId,
        plan,
        status: "active",
        trialEnd: null,
        nextPayment,
      },
    })
    return NextResponse.json(toSubscriptionApi(data))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar/atualizar assinatura" },
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

    const body = (await request.json().catch(() => ({}))) as {
      action?: "cancel" | "reactivate"
      plan?: Subscription["plan"]
    }
    const action = body.action
    if (!action || !["cancel", "reactivate"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 })
    }

    const current = await prisma.subscription.findUnique({
      where: { barbershopId },
    })
    if (!current) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })
    }

    if (action === "cancel") {
      const data = await prisma.subscription.update({
        where: { barbershopId },
        data: {
          status: "canceled",
          trialEnd: null,
          nextPayment: null,
        },
      })
      return NextResponse.json(toSubscriptionApi(data))
    }

    const reactivationPlan =
      body.plan && ["basic", "pro", "premium"].includes(body.plan)
        ? body.plan
        : (current.plan as Subscription["plan"])
    const data = await prisma.subscription.update({
      where: { barbershopId },
      data: {
        plan: reactivationPlan,
        status: "active",
        trialEnd: null,
        nextPayment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    return NextResponse.json(toSubscriptionApi(data))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar assinatura" },
      { status: 500 }
    )
  }
}
