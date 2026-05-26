import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

/** Ranking de barbearias por volume de agendamentos. */
export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const [allTime, last30] = await Promise.all([
      prisma.appointment.groupBy({
        by: ["barbershopId"],
        _count: { _all: true },
        orderBy: { _count: { barbershopId: "desc" } },
        take: 15,
      }),
      prisma.appointment.groupBy({
        by: ["barbershopId"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { barbershopId: "desc" } },
        take: 15,
      }),
    ])

    const ids = [...new Set([...allTime, ...last30].map((r) => r.barbershopId))]
    const shops = await prisma.barbershop.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true, suspendedAt: true },
    })
    const byId = new Map(shops.map((s) => [s.id, s]))

    const mapRows = (
      rows: { barbershopId: string; _count: { _all: number } }[]
    ) =>
      rows.map((r) => {
        const s = byId.get(r.barbershopId)
        return {
          barbershop_id: r.barbershopId,
          name: s?.name ?? "—",
          slug: s?.slug ?? "",
          active: !s?.suspendedAt,
          appointments: r._count._all,
        }
      })

    return NextResponse.json({
      byAppointmentsAllTime: mapRows(allTime),
      byAppointmentsLast30Days: mapRows(last30),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
