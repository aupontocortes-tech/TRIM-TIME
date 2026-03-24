import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

/** Métricas globais — apenas super_admin. Usa Prisma (não depende do cliente Supabase). */
export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const [
      totalBarbershopsAll,
      totalBarbershopsTenants,
      totalClients,
      totalAppointments,
      planRows,
      revenueAgg,
      activeSubs,
    ] = await Promise.all([
      prisma.barbershop.count(),
      prisma.barbershop.count({ where: { NOT: { role: "super_admin" } } }),
      prisma.client.count(),
      prisma.appointment.count(),
      prisma.subscription.groupBy({ by: ["plan"], _count: { _all: true } }),
      prisma.financialLedgerEntry.aggregate({ _sum: { amount: true } }),
      prisma.subscription.count({
        where: { status: { in: ["trial", "active"] } },
      }),
    ])

    const planCounts: Record<string, number> = {}
    for (const row of planRows) {
      planCounts[row.plan] = row._count._all
    }

    const totalRevenue = revenueAgg._sum.amount
      ? Number(revenueAgg._sum.amount)
      : 0

    const countBasic = planCounts["basic"] ?? 0
    const countPro = planCounts["pro"] ?? 0
    const countPremium = planCounts["premium"] ?? 0

    return NextResponse.json({
      totalBarbershops: totalBarbershopsTenants,
      totalBarbershopsIncludingAdmin: totalBarbershopsAll,
      totalClients,
      totalAppointments,
      totalRevenue,
      totalAssinaturasAtivas: activeSubs,
      planBasic: countBasic,
      planPro: countPro,
      planPremium: countPremium,
      /** No produto, “free” ≈ plano básico */
      planFree: countBasic,
      planPremiumTier: countPro + countPremium,
      totalUsuarios: totalClients,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
