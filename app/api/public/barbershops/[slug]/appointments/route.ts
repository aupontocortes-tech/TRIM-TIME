import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getActiveBarbershopBySlug, toPublicClientSession } from "@/lib/public-booking"
import {
  publicClientCookieName,
  signPublicClientSession,
  verifyPublicClientSession,
} from "@/lib/public-client-session"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { cpfDigits } from "@/lib/cpf"
import { trySendWhatsAppAppointmentConfirmation } from "@/lib/whatsapp-appointment-events"
import { parseAppointmentDate, utcDayRangeForYmd } from "@/lib/appointment-prisma-helpers"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"

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
    const unitIdParam = url.searchParams.get("unit_id")?.trim() || null
    if (!date || !barberId) {
      return NextResponse.json({ occupied_times: [] })
    }

    const shop = await getActiveBarbershopBySlug(slug)
    if (!shop || shop.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    let unitId: string | null = null
    if (unitIdParam) {
      const unit = await prisma.barbershopUnit.findFirst({
        where: { id: unitIdParam, barbershopId: shop.id, active: true },
        select: { id: true },
      })
      unitId = unit?.id ?? null
    }

    let dayBounds: { gte: Date; lt: Date }
    try {
      dayBounds = utcDayRangeForYmd(date)
    } catch {
      return NextResponse.json({ occupied_times: [] })
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        barberId,
        ...(unitId ? { unitId } : {}),
        date: { gte: dayBounds.gte, lt: dayBounds.lt },
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
      remarca_appointment_ids?: string[]
      remarca_date?: string
      client?: { nome?: string; telefone?: string; email?: string; cpf?: string; photo_url?: string | null }
    }

    const barberId = String(body.barber_id ?? "").trim()
    const serviceIds = Array.isArray(body.service_ids) ? body.service_ids.map((v) => String(v).trim()).filter(Boolean) : []
    const date = String(body.date ?? "").trim()
    const time = normalizeTime(String(body.time ?? ""))
    const unitId = body.unit_id ? String(body.unit_id).trim() : null
    const clientPayload = body.client ?? {}

    // Prisma espera UUID; se o frontend estiver enviando IDs inválidos (ex.: fallback mock),
    // paramos aqui com uma mensagem clara em vez de estourar erro 500.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const isValidUuid = (v: string) => UUID_RE.test(v)

    if (!isValidUuid(barberId)) {
      return NextResponse.json({ error: "Profissional inválido (id não é UUID)" }, { status: 400 })
    }
    if (serviceIds.some((id) => !isValidUuid(id))) {
      return NextResponse.json({ error: "Serviço inválido (id não é UUID)" }, { status: 400 })
    }

    if (!barberId || !serviceIds.length || !date || !time) {
      return NextResponse.json({ error: "Dados do agendamento incompletos" }, { status: 400 })
    }

    let apptDate: Date
    let apptDayBounds: { gte: Date; lt: Date }
    try {
      apptDate = parseAppointmentDate(date)
      apptDayBounds = utcDayRangeForYmd(date)
    } catch {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    }

    const activeUnits = await prisma.barbershopUnit.findMany({
      where: { barbershopId: shop.id, active: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })

    let effectiveUnitId: string | null = unitId
    if (effectiveUnitId) {
      if (!activeUnits.some((u) => u.id === effectiveUnitId)) {
        return NextResponse.json({ error: "Unidade inválida" }, { status: 400 })
      }
    } else if (activeUnits.length === 1) {
      effectiveUnitId = activeUnits[0].id
    } else if (activeUnits.length > 1) {
      return NextResponse.json({ error: "Selecione a unidade para agendar." }, { status: 400 })
    } else {
      effectiveUnitId = null
    }

    const [barber, services] = await Promise.all([
      prisma.barber.findFirst({
        where: { id: barberId, barbershopId: shop.id, active: true },
        select: { id: true },
      }),
      prisma.service.findMany({
        where: { id: { in: serviceIds }, barbershopId: shop.id, active: true },
        select: { id: true, duration: true, price: true },
      }),
    ])

    if (!barber) {
      return NextResponse.json({ error: "Profissional inválido" }, { status: 400 })
    }
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: "Um ou mais serviços não estão disponíveis" }, { status: 400 })
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
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            cpf: true,
            notes: true,
          },
        })
      : null

    const nome = String(clientPayload.nome ?? client?.name ?? "").trim()
    const telefone = String(clientPayload.telefone ?? client?.phone ?? "").trim()
    const email = String(clientPayload.email ?? client?.email ?? "").trim().toLowerCase()
    const cpfPayload = String(clientPayload.cpf ?? "").trim()
    let cpfUpdate: string | null | undefined = undefined
    if (cpfPayload) {
      const d = cpfDigits(cpfPayload)
      if (!d) {
        return NextResponse.json({ error: "CPF inválido (11 dígitos)" }, { status: 400 })
      }
      cpfUpdate = d
    }

    /** Só altera foto quando vier string (incl. "" para limpar). `null` no JSON não apaga — evita apagar foto por engano. */
    let photoUpdate: string | null | undefined = undefined
    const rawPhoto = clientPayload.photo_url
    if (rawPhoto !== undefined && rawPhoto !== null) {
      try {
        photoUpdate = assertValidProfilePhotoDataUrl(rawPhoto)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Foto inválida" },
          { status: 400 }
        )
      }
    }

    if (!client) {
      if (!nome || !telefone) {
        return NextResponse.json({ error: "Informe nome e telefone para continuar" }, { status: 400 })
      }
      const byPhone = await findClientByPhoneDigits(shop.id, telefone)
      if (byPhone) {
        client = byPhone
      } else {
        client = await prisma.client.create({
          data: {
            barbershopId: shop.id,
            name: nome,
            phone: telefone || null,
            email: email || null,
            cpf: cpfUpdate ?? null,
            photoUrl: photoUpdate ?? null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            cpf: true,
            notes: true,
          },
        })
      }
    }

    if (
      client &&
      (nome || telefone || email || cpfUpdate !== undefined || photoUpdate !== undefined)
    ) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          name: nome || client.name,
          phone: telefone || client.phone || null,
          email: email || client.email || null,
          ...(cpfUpdate !== undefined ? { cpf: cpfUpdate } : {}),
          ...(photoUpdate !== undefined ? { photoUrl: photoUpdate } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          photoUrl: true,
          cpf: true,
          notes: true,
        },
      })
    }

    if (!client) {
      return NextResponse.json({ error: "Não foi possível identificar o cliente" }, { status: 400 })
    }

    const remarcaAppointmentIds = Array.isArray(body.remarca_appointment_ids)
      ? body.remarca_appointment_ids.map((v) => String(v).trim()).filter(Boolean)
      : []
    const remarcaDate = String(body.remarca_date ?? "").trim()
    let remarcaDayBounds: { gte: Date; lt: Date } | null = null
    if (!remarcaAppointmentIds.length && remarcaDate) {
      try {
        remarcaDayBounds = utcDayRangeForYmd(remarcaDate)
      } catch {
        remarcaDayBounds = null
      }
    }

    const existingSameDay = await prisma.appointment.findFirst({
      where: {
        barbershopId: shop.id,
        clientId: client.id,
        date: { gte: apptDayBounds.gte, lt: apptDayBounds.lt },
        status: { not: "canceled" },
        ...(remarcaAppointmentIds.length
          ? { id: { notIn: remarcaAppointmentIds } }
          : {}),
      },
      select: { id: true },
    })
    if (existingSameDay) {
      return NextResponse.json(
        {
          error:
            "Você já possui um agendamento neste dia. Escolha outra data ou entre em contato com a barbearia.",
        },
        { status: 409 }
      )
    }

    const times = orderedServices.map((service, index) => {
      const minutesBefore = orderedServices.slice(0, index).reduce((sum, item) => sum + item.duration, 0)
      return { service, time: addMinutes(time, minutesBefore) }
    })

    const conflicts = await prisma.appointment.findMany({
      where: {
        barbershopId: shop.id,
        barberId,
        date: { gte: apptDayBounds.gte, lt: apptDayBounds.lt },
        status: { in: ["pending", "confirmed"] },
        time: { in: times.map((item) => item.time) },
        ...(remarcaAppointmentIds.length
          ? { id: { notIn: remarcaAppointmentIds } }
          : {}),
      },
      select: { time: true },
    })
    if (conflicts.length > 0) {
      return NextResponse.json(
        { error: "Este horário não está mais disponível. Escolha outro." },
        { status: 409 }
      )
    }

    const created = await prisma.$transaction(async (tx) => {
      const inserted = await Promise.all(
        times.map((item) =>
          tx.appointment.create({
            data: {
              barbershopId: shop.id,
              clientId: client.id,
              barberId,
              serviceId: item.service.id,
              unitId: effectiveUnitId,
              date: apptDate,
              time: item.time,
              status: "pending",
              totalPrice: item.service.price,
            },
            select: { id: true, time: true },
          })
        )
      )

      if (remarcaAppointmentIds.length) {
        await tx.appointment.updateMany({
          where: {
            id: { in: remarcaAppointmentIds },
            barbershopId: shop.id,
            clientId: client.id,
            status: { in: ["pending", "confirmed"] },
          },
          data: { status: "canceled" },
        })
      } else if (remarcaDayBounds) {
        await tx.appointment.updateMany({
          where: {
            barbershopId: shop.id,
            clientId: client.id,
            date: { gte: remarcaDayBounds.gte, lt: remarcaDayBounds.lt },
            status: { in: ["pending", "confirmed"] },
            id: { notIn: inserted.map((it) => it.id) },
          },
          data: { status: "canceled" },
        })
      }

      return inserted
    })

    if (created.length > 0) {
      void trySendWhatsAppAppointmentConfirmation(shop.id, created[0].id)
    }

    cookieStore.set(
      publicClientCookieName(slug),
      signPublicClientSession({ clientId: client.id, slug }),
      {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      }
    )

    return NextResponse.json({
      ok: true,
      appointment_ids: created.map((item) => item.id),
      client: toPublicClientSession(client),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar agendamento" },
      { status: 500 }
    )
  }
}
