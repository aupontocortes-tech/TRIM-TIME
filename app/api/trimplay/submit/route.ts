import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      barbershop_id?: string
      unit_id?: string | null
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

    let unitId: string | null = null
    const rawUnit = typeof body.unit_id === "string" ? body.unit_id.trim() : null
    if (rawUnit) {
      const u = await prisma.barbershopUnit.findFirst({
        where: { id: rawUnit, barbershopId },
        select: { id: true },
      })
      if (!u) {
        return NextResponse.json({ error: "unit_id inválido para esta barbearia" }, { status: 400 })
      }
      unitId = u.id
    }

    const score = typeof scoreRaw === "number" ? Math.floor(scoreRaw) : Number(scoreRaw)
    if (!Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: "score inválido" }, { status: 400 })
    }

    const existing = await prisma.trimPlayScore.findFirst({
      where: { barbershopId, clienteId, unitId },
      select: { id: true, bestScore: true },
    })

    if (existing) {
      await prisma.trimPlayScore.update({
        where: { id: existing.id },
        data: { bestScore: existing.bestScore + score, clienteNome: clienteName },
      })
    } else {
      await prisma.trimPlayScore.create({
        data: {
          barbershopId,
          unitId,
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
