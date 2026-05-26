import { NextResponse } from "next/server"
import { findBarberByPortalToken, isValidPortalToken } from "@/lib/barber-portal-resolve"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    if (!isValidPortalToken(portalToken)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }
    const barber = await findBarberByPortalToken(portalToken)
    if (!barber || barber.barbershop.suspendedAt) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      barbershop_name: barber.barbershop.name,
      barbershop_slug: barber.barbershop.slug,
      barber_name: barber.name,
      has_password: !!barber.passwordHash,
      commission_percent: Number(barber.commission),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar" },
      { status: 500 }
    )
  }
}
