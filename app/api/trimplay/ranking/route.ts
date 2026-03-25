import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const barbershopId = url.searchParams.get("barbershop_id")?.trim() ?? ""
    const clienteId = url.searchParams.get("cliente_id")?.trim() ?? ""

    if (!barbershopId) {
      return NextResponse.json({ error: "barbershop_id é obrigatório" }, { status: 400 })
    }

    const top = await prisma.trimPlayScore.findMany({
      where: { barbershopId },
      orderBy: { bestScore: "desc" },
      take: 10,
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
        where: { barbershopId, clienteId },
        select: { bestScore: true },
      })
      if (me) {
        const greater = await prisma.trimPlayScore.count({
          where: { barbershopId, bestScore: { gt: me.bestScore } },
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

