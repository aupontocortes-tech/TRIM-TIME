import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"
import type { SubscriptionPlan } from "@/lib/db/types"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = (await request.json()) as {
      name?: string
      email?: string
      phone?: string | null
      role?: "super_admin" | "admin_barbershop"
      suspended?: boolean
      is_test?: boolean
      plan?: SubscriptionPlan
    }

    const existing = await prisma.barbershop.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    if (
      body.name !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.role !== undefined ||
      body.suspended !== undefined ||
      body.is_test !== undefined
    ) {
      await prisma.barbershop.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name.trim() }),
          ...(body.email !== undefined && { email: body.email.trim().toLowerCase() }),
          ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
          ...(body.role !== undefined && { role: body.role }),
          ...(body.suspended !== undefined && {
            suspendedAt: body.suspended ? new Date() : null,
          }),
          ...(body.is_test !== undefined && { isTest: Boolean(body.is_test) }),
        },
      })
    }

    if (body.plan !== undefined) {
      await prisma.subscription.updateMany({
        where: { barbershopId: id },
        data: {
          plan: body.plan,
          status: "active",
          trialEnd: null,
        },
      })
    }

    const updated = await prisma.barbershop.findUnique({
      where: { id },
      include: { subscriptions: true },
    })
    if (!updated) {
      return NextResponse.json({ error: "Erro ao recarregar" }, { status: 500 })
    }
    const sub = updated.subscriptions[0]
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      slug: updated.slug,
      role: updated.role,
      suspended_at: updated.suspendedAt?.toISOString() ?? null,
      is_test: updated.isTest,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
      subscription: sub
        ? { plan: sub.plan, status: sub.status }
        : null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
