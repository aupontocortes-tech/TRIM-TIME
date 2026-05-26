import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

/** Lista barbearias + assinatura. Apenas super_admin. */
export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const rows = await prisma.barbershop.findMany({
      orderBy: { createdAt: "desc" },
      include: { subscriptions: true },
    })

    const list = rows.map((b) => {
      const sub = b.subscriptions[0]
      return {
        id: b.id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        slug: b.slug,
        role: b.role,
        suspended_at: b.suspendedAt?.toISOString() ?? null,
        is_test: b.isTest,
        created_at: b.createdAt.toISOString(),
        updated_at: b.updatedAt.toISOString(),
        subscription: sub
          ? { plan: sub.plan, status: sub.status }
          : null,
      }
    })

    return NextResponse.json(list)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
