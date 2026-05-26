import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { publicClientCookieName, verifyPublicClientSession } from "@/lib/public-client-session"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { utcDayRangeForYmd } from "@/lib/appointment-prisma-helpers"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"

/**
 * Cancela agendamentos do cliente (remarcação: libera o dia para novo horário).
 * Autenticação: cookie da sessão pública OU telefone que identifica o mesmo cliente da barbearia.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    await expireStaleAppointmentsForBarbershop(shop.id)

    const body = (await request.json().catch(() => ({}))) as {
      appointment_ids?: string[]
      date?: string
      telefone?: string
    }

    const cookieStore = await cookies()
    const raw = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, raw)

    let clientId: string | null = null
    if (session) {
      const row = await prisma.client.findFirst({
        where: { id: session.clientId, barbershopId: shop.id },
        select: { id: true },
      })
      if (row) clientId = row.id
    }

    const telefone = String(body.telefone ?? "").trim()
    if (!clientId && telefone) {
      const found = await findClientByPhoneDigits(shop.id, telefone)
      if (found) clientId = found.id
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Entre com sua conta ou use o mesmo telefone do agendamento para remarcar." },
        { status: 401 }
      )
    }

    const ids = Array.isArray(body.appointment_ids)
      ? body.appointment_ids.map((v) => String(v).trim()).filter(Boolean)
      : []
    const dateStr = String(body.date ?? "").trim()

    if (ids.length > 0) {
      await prisma.appointment.updateMany({
        where: {
          id: { in: ids },
          barbershopId: shop.id,
          clientId,
          status: { in: ["pending", "confirmed"] },
        },
        data: { status: "canceled" },
      })
    } else if (dateStr) {
      let dayBounds: { gte: Date; lt: Date }
      try {
        dayBounds = utcDayRangeForYmd(dateStr)
      } catch {
        return NextResponse.json({ error: "Data inválida" }, { status: 400 })
      }
      await prisma.appointment.updateMany({
        where: {
          barbershopId: shop.id,
          clientId,
          date: { gte: dayBounds.gte, lt: dayBounds.lt },
          status: { in: ["pending", "confirmed"] },
        },
        data: { status: "canceled" },
      })
    } else {
      return NextResponse.json(
        { error: "Informe appointment_ids ou date (YYYY-MM-DD)." },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao cancelar" },
      { status: 500 }
    )
  }
}
