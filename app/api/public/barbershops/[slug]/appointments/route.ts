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
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"
import { clientHasBlockingAppointmentOnDay } from "@/lib/client-same-day-appointment"
import { appointmentStartsAtUtcFromYmd } from "@/lib/appointment-reminder-time"
import type { BarbershopSettings } from "@/lib/db/types"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import { validateBarberForUnit } from "@/lib/unit-context"
import { withAppointmentDbSchema } from "@/lib/appointment-db-schema"
import { isValidUuid } from "@/lib/is-uuid"

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

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

function minutesFromHHMM(time: string): number | null {
  const [hh, mm] = normalizeTime(time).split(":").map((v) => Number(v))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

function weekdayKeyFromYmd(ymd: string):
  | "domingo"
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado" {
  const [y, m, d] = ymd.split("-").map(Number)
  const js = new Date(y, (m || 1) - 1, d || 1).getDay()
  return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][js] as
    | "domingo"
    | "segunda"
    | "terca"
    | "quarta"
    | "quinta"
    | "sexta"
    | "sabado"
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

    await withAppointmentDbSchema(() => expireStaleAppointmentsForBarbershop(shop.id))

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

    const appointments = await withAppointmentDbSchema(() =>
      prisma.appointment.findMany({
        where: {
          barbershopId: shop.id,
          barberId,
          ...(unitId
            ? {
                OR: [{ unitId }, { unitId: null, barber: { unitId } }],
              }
            : {}),
          date: { gte: dayBounds.gte, lt: dayBounds.lt },
          status: { in: ["pending", "confirmed"] },
        },
        select: { time: true },
        orderBy: { time: "asc" },
      })
    )

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

    await withAppointmentDbSchema(() => expireStaleAppointmentsForBarbershop(shop.id))

    const planForWaitlist = await resolveEffectivePlanForBarbershop(shop.id)
    const waitlistAvailable = !!(planForWaitlist && hasFeature(planForWaitlist, "waiting_list"))

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

    const settings = (shop.settings as BarbershopSettings | null) ?? null
    const bookingRules = settings?.booking_rules
    const minLeadMinutes = Math.max(0, Math.round(Number(bookingRules?.min_lead_minutes ?? 30) || 30))
    const now = new Date()
    if (date === localYmd(now)) {
      const slotMin = minutesFromHHMM(time)
      if (slotMin == null) {
        return NextResponse.json({ error: "Horário inválido" }, { status: 400 })
      }
      const slotStart = appointmentStartsAtUtcFromYmd(date, time)
      if (Number.isNaN(slotStart.getTime())) {
        return NextResponse.json({ error: "Horário inválido" }, { status: 400 })
      }
      if (slotStart.getTime() < now.getTime() + minLeadMinutes * 60_000) {
        return NextResponse.json(
          {
            error: `Escolha um horário com pelo menos ${minLeadMinutes} min de antecedência.`,
          },
          { status: 409 }
        )
      }
    }

    const dayKey = weekdayKeyFromYmd(date)
    const blockedRanges = Array.isArray(bookingRules?.blocked_ranges?.[dayKey])
      ? bookingRules?.blocked_ranges?.[dayKey] ?? []
      : []
    const selectedMinutes = minutesFromHHMM(time)
    if (selectedMinutes != null) {
      const blocked = blockedRanges.some((range) => {
        const start = minutesFromHHMM(String(range?.start ?? ""))
        const end = minutesFromHHMM(String(range?.end ?? ""))
        return start != null && end != null && end > start && selectedMinutes >= start && selectedMinutes < end
      })
      if (blocked) {
        return NextResponse.json({ error: "Este horário está bloqueado pela barbearia." }, { status: 409 })
      }
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
        select: { id: true, unitId: true },
      }),
      prisma.service.findMany({
        where: { id: { in: serviceIds }, barbershopId: shop.id, active: true },
        select: { id: true, duration: true, price: true },
      }),
    ])

    if (!barber) {
      return NextResponse.json({ error: "Profissional inválido" }, { status: 400 })
    }

    if (!effectiveUnitId && barber.unitId) {
      effectiveUnitId = barber.unitId
    }

    const barberUnitCheck = await validateBarberForUnit({
      barbershopId: shop.id,
      barberId,
      unitId: effectiveUnitId,
    })
    if (!barberUnitCheck.ok) {
      return NextResponse.json({ error: barberUnitCheck.error }, { status: barberUnitCheck.status })
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
    if (!session) {
      return NextResponse.json(
        { error: "Faça login para agendar. Confirme o acesso pelo link enviado ao seu e-mail." },
        { status: 401 }
      )
    }

    let client = await prisma.client.findFirst({
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

    if (!client) {
      return NextResponse.json(
        { error: "Sessão inválida ou expirada. Entre novamente pelo link de verificação." },
        { status: 401 }
      )
    }

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

    const existingSameDay = await clientHasBlockingAppointmentOnDay({
      barbershopId: shop.id,
      clientId: client.id,
      dayBounds: apptDayBounds,
      ignoreAppointmentIds: remarcaAppointmentIds.length ? remarcaAppointmentIds : undefined,
    })
    if (existingSameDay) {
      return NextResponse.json(
        {
          error:
            "Você já possui um agendamento ativo neste dia. Remarque pelo app, escolha outra data ou fale com a barbearia.",
        },
        { status: 409 }
      )
    }

    const times = orderedServices.map((service, index) => {
      const minutesBefore = orderedServices.slice(0, index).reduce((sum, item) => sum + item.duration, 0)
      return { service, time: addMinutes(time, minutesBefore) }
    })

    const conflicts = await withAppointmentDbSchema(() =>
      prisma.appointment.findMany({
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
    )
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "Este horário não está mais disponível. Escolha outro.",
          code: "SLOT_UNAVAILABLE",
          waitlist_available: waitlistAvailable,
        },
        { status: 409 }
      )
    }

    const created = await withAppointmentDbSchema(() =>
      prisma.$transaction(async (tx) => {
      const inserted = await Promise.all(
        times.map((item) =>
          tx.appointment.create({
            data: {
              barbershopId: shop.id,
              clientId: client.id,
              barberId,
              serviceId: item.service.id,
              unitId: effectiveUnitId ?? barber.unitId,
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
    )

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
