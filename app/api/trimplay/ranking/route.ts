import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const barbershopId = url.searchParams.get("barbershop_id")?.trim() ?? ""
    const clienteId = url.searchParams.get("cliente_id")?.trim() ?? ""
    const unitRaw = url.searchParams.get("unit_id")

    if (!barbershopId) {
      return NextResponse.json({ error: "barbershop_id é obrigatório" }, { status: 400 })
    }

    let unitId: string | null = null
    if (unitRaw !== null && unitRaw !== "" && unitRaw !== "null") {
      const id = unitRaw.trim()
      const u = await prisma.barbershopUnit.findFirst({
        where: { id, barbershopId },
        select: { id: true },
      })
      if (!u) {
        return NextResponse.json({ error: "unit_id inválido para esta barbearia" }, { status: 400 })
      }
      unitId = u.id
    }

    const top = await prisma.trimPlayScore.findMany({
      where: { barbershopId, unitId },
      orderBy: { bestScore: "desc" },
      select: { clienteId: true, clienteNome: true, bestScore: true },
    })

    const topWithRank = top.map((r, i) => ({
      rank: i + 1,
      cliente_id: r.clienteId,
      cliente_nome: r.clienteNome,
      score: r.bestScore,
    }))

    let my = null as null | { cliente_id: string; score: number; rank: number }
    if (clienteId) {
      const me = await prisma.trimPlayScore.findFirst({
        where: { barbershopId, unitId, clienteId },
        select: { bestScore: true },
      })
      if (me) {
        const greater = await prisma.trimPlayScore.count({
          where: { barbershopId, unitId, bestScore: { gt: me.bestScore } },
        })
        my = {
          cliente_id: clienteId,
          score: me.bestScore,
          rank: greater + 1,
        }
      }
    }

    return NextResponse.json({ top: topWithRank, my })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    )
  }
}
