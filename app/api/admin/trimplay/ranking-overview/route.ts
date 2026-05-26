import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

/**
 * Visão global: uma linha por barbearia (nome + recorde + quantidade de posições no ranking).
 * Não expõe filtro por unidade — detalhe fica no painel do dono.
 */
export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const grouped = await prisma.trimPlayScore.groupBy({
      by: ["barbershopId"],
      _max: { bestScore: true },
      _count: { _all: true },
    })
    const agg = new Map(
      grouped.map((g) => [
        g.barbershopId,
        { topScore: g._max.bestScore ?? 0, entries: g._count._all },
      ])
    )

    const shops = await prisma.barbershop.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    const items = shops
      .map((s) => {
        const a = agg.get(s.id)
        return {
          barbershop_id: s.id,
          name: s.name,
          top_score: a ? a.topScore : null,
          ranking_entries: a ? a.entries : 0,
        }
      })
      .sort((x, y) => {
        const sx = x.top_score ?? -1
        const sy = y.top_score ?? -1
        if (sy !== sx) return sy - sx
        return x.name.localeCompare(y.name, "pt-BR")
      })
      .map((row, i) => ({ ...row, rank: i + 1 }))

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    )
  }
}
