import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug } from "@/lib/public-booking"
import { publicClientCookieName, verifyPublicClientSession } from "@/lib/public-client-session"

function normalizeTime(time: string) {
  const raw = String(time ?? "").trim()
  return raw.length >= 5 ? raw.slice(0, 5) : raw
}

function addMinutes(time: string, minutes: number) {
  const [hh, mm] = normalizeTime(time).split(":").map((v) => Number(v))
  const total = hh * 60 + mm + minutes
  const outH = Math.floor(total / 60)
  const outM = total % 60
  return `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const date = url.searchParams.get("date")?.trim()
    const barberId = url.searchParams.get("barber_id")?.trim()
    if (!date || !barberId) {
      return NextResponse.json({ occupied_times: [] })
    }

    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        barberId,
        date: new Date(`${date}T00:00:00`),
        status: { in: ["pending", "confirmed"] },
      },
      select: { time: true },
      orderBy: { time: "asc" },
    })

    return NextResponse.json({
      occupied_times: appointments.map((a) => normalizeTime(a.time)),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar horários" },
      { status: 500 }
    )
  }
}

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

    const body = (await request.json().catch(() => ({}))) as {
      barber_id?: string
      service_ids?: string[]
      date?: string
      time?: string
      unit_id?: string | null
      client?: { nome?: string; telefone?: string; email?: string }
    }

    const barberId = String(body.barber_id ?? "").trim()
    const serviceIds = Array.isArray(body.service_ids) ? body.service_ids.map((v) => String(v).trim()).filter(Boolean) : []
    const date = String(body.date ?? "").trim()
    const time = normalizeTime(String(body.time ?? ""))
    const unitId = body.unit_id ? String(body.unit_id).trim() : null
    const clientPayload = body.client ?? {}

    if (!barberId || !serviceIds.length || !date || !time) {
      return NextResponse.json({ error: "Dados do agendamento incompletos" }, { status: 400 })
    }

    const [barber, services, unit] = await Promise.all([
      prisma.barber.findFirst({
        where: { id: barberId, barbershopId: shop.id, active: true },
        select: { id: true },
      }),
      prisma.service.findMany({
        where: { id: { in: serviceIds }, barbershopId: shop.id, active: true },
        select: { id: true, duration: true, price: true },
      }),
      unitId
        ? prisma.barbershopUnit.findFirst({
            where: { id: unitId, barbershopId: shop.id, active: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ])

    if (!barber) {
      return NextResponse.json({ error: "Profissional inválido" }, { status: 400 })
    }
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: "Um ou mais serviços não estão disponíveis" }, { status: 400 })
    }
    if (unitId && !unit) {
      return NextResponse.json({ error: "Unidade inválida" }, { status: 400 })
    }

    const orderedServices = serviceIds
      .map((id) => services.find((svc) => svc.id === id))
      .filter((svc): svc is NonNullable<typeof svc> => !!svc)

    const cookieStore = await cookies()
    const rawSession = cookieStore.get(publicClientCookieName(slug))?.value
    const session = verifyPublicClientSession(slug, rawSession)
    let client = session
      ? await prisma.client.findFirst({
          where: { id: session.clientId, barbershopId: shop.id },
          select: { id: true, name: true, email: true, phone: true },
        })
      : null

    const nome = String(clientPayload.nome ?? client?.name ?? "").trim()
    const telefone = String(clientPayload.telefone ?? client?.phone ?? "").trim()
    const email = String(clientPayload.email ?? client?.email ?? "").trim().toLowerCase()

    if (!client) {
      if (!nome || !telefone) {
        return NextResponse.json({ error: "Informe nome e telefone para continuar" }, { status: 400 })
      }
      client = await prisma.client.create({
        data: {
          barbershopId: shop.id,
          name: nome,
          phone: telefone || null,
          email: email || null,
        },
        select: { id: true, name: true, email: true, phone: true },
      })
    } else if (nome || telefone || email) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          name: nome || client.name,
          phone: telefone || client.phone || null,
          email: email || client.email || null,
        },
        select: { id: true, name: true, email: true, phone: true },
      })
    }

    const times = orderedServices.map((service, index) => {
      const minutesBefore = orderedServices.slice(0, index).reduce((sum, item) => sum + item.duration, 0)
      return { service, time: addMinutes(time, minutesBefore) }
    })

    const conflicts = await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        barberId,
        date: new Date(`${date}T00:00:00`),
        status: { in: ["pending", "confirmed"] },
        time: { in: times.map((item) => item.time) },
      },
      select: { time: true },
    })
    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: "Este horário não está mais disponível. Escolha outro." },
        { status: 409 }
      )
    }

    const created = await prisma.$transaction(
      times.map((item) =>
        prisma.appointment.create({
          data: {
            barbershopId: shop.id,
            clientId: client.id,
            barberId,
            serviceId: item.service.id,
            unitId,
            date: new Date(`${date}T00:00:00`),
            time: item.time,
            status: "pending",
            totalPrice: item.service.price,
          },
          select: { id: true, time: true },
        })
      )
    )

    return NextResponse.json({
      ok: true,
      appointment_ids: created.map((item) => item.id),
      client: {
        id: client.id,
        nome: client.name,
        telefone: client.phone ?? "",
        email: client.email ?? "",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar agendamento" },
      { status: 500 }
    )
  }
}
