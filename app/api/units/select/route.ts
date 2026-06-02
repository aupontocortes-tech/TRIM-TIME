import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { BARBERSHOP_UNIT_COOKIE, requireBarbershopId } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = (await request.json()) as { unit_id?: string | null }
    const cookieStore = await cookies()

    if (!body.unit_id) {
      cookieStore.delete(BARBERSHOP_UNIT_COOKIE)
      return NextResponse.json({ ok: true, unit_id: null })
    }

    const unitId = String(body.unit_id).trim()
    const row = await prisma.barbershopUnit.findFirst({
      where: { id: unitId, barbershopId },
      select: { id: true },
    })

    if (!row?.id) {
      return NextResponse.json({ error: "Unidade inválida para esta conta" }, { status: 400 })
    }

    cookieStore.set(BARBERSHOP_UNIT_COOKIE, row.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return NextResponse.json({ ok: true, unit_id: row.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao trocar unidade" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

