import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { publicClientCookieName, verifyPublicClientSession } from "@/lib/public-client-session"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"

type AppointmentRow = {
  id: string
  date: Date
  time: string
  totalPrice: unknown
  service: { id: string; name: string; duration: number }
  barber: { id: string; name: string }
  unit: { id: string; name: string } | null
}

export async function GET(
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

    const url = new URL(request.url)
    const phone = url.searchParams.get("phone")?.trim() ?? ""

    const cookieStore = await cookies()
    const raw = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, raw)

    let client = session
      ? await prisma.client.findFirst({
          where: { id: session.clientId, barbershopId: shop.id },
          select: { id: true, name: true },
        })
      : null

    if (!client && phone) {
      const byPhone = await findClientByPhoneDigits(shop.id, phone)
      if (byPhone) {
        client = { id: byPhone.id, name: byPhone.name }
      }
    }

    if (!client) {
      return NextResponse.json({ appointment: null })
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const next = await prisma.appointment.findFirst({
      where: {
        barbershopId: shop.id,
        clientId: client.id,
        status: { in: ["pending", "confirmed"] },
        date: { gte: now },
      },
      select: { date: true },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    })

    if (!next) {
      return NextResponse.json({ appointment: null })
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        clientId: client.id,
        status: { in: ["pending", "confirmed"] },
        date: next.date,
      },
      select: {
        id: true,
        date: true,
        time: true,
        totalPrice: true,
        service: { select: { id: true, name: true, duration: true } },
        barber: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: [{ time: "asc" }, { createdAt: "asc" }],
    })) as AppointmentRow[]

    if (rows.length === 0) {
      return NextResponse.json({ appointment: null })
    }

    const first = rows[0]
    const totalPrice = rows.reduce((sum, row) => {
      const n = typeof row.totalPrice === "number" ? row.totalPrice : Number(row.totalPrice ?? 0)
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
    const totalDuration = rows.reduce((sum, row) => sum + (row.service.duration || 0), 0)

    return NextResponse.json({
      appointment: {
        client_id: client.id,
        client_name: client.name,
        date: first.date.toISOString().slice(0, 10),
        time: first.time,
        barber_id: first.barber.id,
        barber_name: first.barber.name,
        unit_id: first.unit?.id ?? null,
        unit_name: first.unit?.name ?? null,
        services: rows.map((row) => ({
          id: row.service.id,
          name: row.service.name,
          duration: row.service.duration,
          price: typeof row.totalPrice === "number" ? row.totalPrice : Number(row.totalPrice ?? 0),
        })),
        appointment_ids: rows.map((row) => row.id),
        total_price: totalPrice,
        total_duration: totalDuration,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar agendamento atual" },
      { status: 500 }
    )
  }
}
