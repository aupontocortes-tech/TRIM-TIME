import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { isValidPortalToken } from "@/lib/barber-portal-resolve"
import { barberPortalCookieName, verifyBarberPortalSession } from "@/lib/barber-portal-session"
import {
  appointmentApiInclude,
  mapAppointmentRowToApi,
  parseAppointmentDate,
} from "@/lib/appointment-prisma-helpers"
import type { Prisma } from "@prisma/client"
import { withServiceDescriptionsFromDb } from "@/lib/service-queries"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"
import type { Appointment } from "@/lib/db/types"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ portalToken: string }> }
) {
  try {
    const { portalToken } = await params
    if (!isValidPortalToken(portalToken)) {
      return NextResponse.json({ error: "Link inválido" }, { status: 400 })
    }
    const raw = (await cookies()).get(barberPortalCookieName())?.value
    const session = verifyBarberPortalSession(portalToken, raw)
    if (!session) {
      return NextResponse.json({ error: "Faça login para ver sua agenda." }, { status: 401 })
    }

    const barber = await prisma.barber.findFirst({
      where: {
        id: session.barberId,
        barbershopId: session.barbershopId,
        portalToken,
        active: true,
      },
      select: { id: true, barbershopId: true },
    })
    if (!barber) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
    }

    await expireStaleAppointmentsForBarbershop(barber.barbershopId)

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")?.trim()
    const from = searchParams.get("from")?.trim()
    const to = searchParams.get("to")?.trim()

    const dateFilter: Prisma.DateTimeFilter | undefined = (() => {
      if (date) return { equals: parseAppointmentDate(date) }
      if (from || to) {
        const f: Prisma.DateTimeFilter = {}
        if (from) f.gte = parseAppointmentDate(from)
        if (to) f.lte = parseAppointmentDate(to)
        return Object.keys(f).length ? f : undefined
      }
      return undefined
    })()

    const rows = await prisma.appointment.findMany({
      where: {
        barbershopId: barber.barbershopId,
        barberId: barber.id,
        ...(dateFilter ? { date: dateFilter } : {}),
        status: { not: "no_show" },
      },
      include: appointmentApiInclude,
      orderBy: [{ date: "asc" }, { time: "asc" }],
    })

    const list = rows.map(mapAppointmentRowToApi) as Appointment[]
    return NextResponse.json(await withServiceDescriptionsFromDb(list))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar agenda" },
      { status: 500 }
    )
  }
}
