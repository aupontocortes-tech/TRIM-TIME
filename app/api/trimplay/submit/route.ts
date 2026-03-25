import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      barbershop_id?: string
      cliente_id?: string
      cliente_name?: string
      score?: unknown
    }

    const barbershopId = body.barbershop_id?.trim()
    const clienteId = body.cliente_id?.trim()
    const clienteName = body.cliente_name?.trim()
    const scoreRaw = body.score

    if (!barbershopId || !clienteId || !clienteName) {
      return NextResponse.json({ error: "barbershop_id, cliente_id e cliente_name são obrigatórios" }, { status: 400 })
    }

    const score = typeof scoreRaw === "number" ? Math.floor(scoreRaw) : Number(scoreRaw)
    if (!Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: "score inválido" }, { status: 400 })
    }

    const existing = await prisma.trimPlayScore.findFirst({
      where: { barbershopId, clienteId },
      select: { id: true, bestScore: true },
    })

    if (existing) {
      if (score > existing.bestScore) {
        await prisma.trimPlayScore.update({
          where: { id: existing.id },
          data: { bestScore: score, clienteNome: clienteName },
        })
      } else {
        // Mantém o recorde atual.
      }
    } else {
      await prisma.trimPlayScore.create({
        data: {
          barbershopId,
          clienteId,
          clienteNome: clienteName,
          bestScore: score,
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    )
  }
}

