import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBarbershopId } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/** Ranking do Trim Play da própria barbearia (painel). Opcional: filtrar por unidade. */
export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const url = new URL(request.url)
    const unitRaw = url.searchParams.get("unit_id")

    let unitId: string | null = null
    if (unitRaw !== null && unitRaw !== "" && unitRaw !== "null") {
      const id = unitRaw.trim()
      const u = await prisma.barbershopUnit.findFirst({
        where: { id, barbershopId },
        select: { id: true },
      })
      if (!u) {
        return NextResponse.json({ error: "Unidade inválida" }, { status: 400 })
      }
      unitId = u.id
    }

    const rows = await prisma.trimPlayScore.findMany({
      where: { barbershopId, unitId },
      orderBy: { bestScore: "desc" },
      take: 100,
      select: {
        clienteId: true,
        clienteNome: true,
        bestScore: true,
        updatedAt: true,
      },
    })

    const top = rows.map((r, i) => ({
      rank: i + 1,
      cliente_id: r.clienteId,
      cliente_nome: r.clienteNome,
      score: r.bestScore,
      updated_at: r.updatedAt.toISOString(),
    }))

    return NextResponse.json({ top })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno"
    if (msg.includes("Barbershop")) {
      return NextResponse.json({ error: msg }, { status: 401 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
