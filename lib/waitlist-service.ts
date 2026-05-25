/**
 * Lista de espera: expiração por prazo, próximo da fila ao liberar vaga, métricas de posição.
 */
import type { WaitingListStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { Appointment, BarbershopSettings } from "@/lib/db/types"
import { parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
import type { Prisma } from "@prisma/client"

export const WAITLIST_DEFAULT_ACCEPT_MINUTES = 15

export function getWaitlistAcceptDeadlineMinutes(settings: BarbershopSettings | null | undefined): number {
  const raw = settings?.waitlist_accept_deadline_minutes
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 1) return WAITLIST_DEFAULT_ACCEPT_MINUTES
  return Math.min(24 * 60, Math.max(1, Math.round(n)))
}

export function normalizeWaitlistTime(time: string): string {
  const raw = String(time ?? "").trim()
  return raw.length >= 5 ? raw.slice(0, 5) : raw
}

function ymdFromDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function primaryServiceIdFromAppointment(appt: Appointment): string {
  const lines = appt.service_lines
  if (lines && lines.length > 0) return lines[0].service_id
  return appt.service_id
}

export function parseExtraServiceIds(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === "string" && x.length > 0)
}

const WAITLIST_TTL_DAYS = 7

/** Expira itens 'waiting' que ultrapassaram o TTL (7 dias sem receber vaga). */
export async function expireOldWaitingItems(barbershopId: string): Promise<void> {
  const cutoff = new Date(Date.now() - WAITLIST_TTL_DAYS * 24 * 60 * 60_000)
  await prisma.waitingListItem.updateMany({
    where: {
      barbershopId,
      status: "waiting",
      createdAt: { lt: cutoff },
    },
    data: { status: "expired" },
  })
}

/** Expira notificações antigas e notifica o próximo da fila com o mesmo horário ofertado. */
export async function expireStaleWaitlistNotifications(barbershopId: string): Promise<void> {
  const bs = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { settings: true },
  })
  const settings = (bs?.settings as BarbershopSettings | null) ?? null
  const minutes = getWaitlistAcceptDeadlineMinutes(settings)
  const cutoff = new Date(Date.now() - minutes * 60_000)

  const stale = await prisma.waitingListItem.findMany({
    where: {
      barbershopId,
      status: "notified",
      notifiedAt: { lt: cutoff },
    },
    select: {
      id: true,
      barberId: true,
      serviceId: true,
      offeredDate: true,
      offeredTime: true,
    },
  })

  for (const row of stale) {
    await prisma.waitingListItem.update({
      where: { id: row.id },
      data: { status: "expired" },
    })
    if (row.offeredDate && row.offeredTime) {
      await notifyNextWaitingForFreedSlot(barbershopId, {
        barberId: row.barberId,
        serviceId: row.serviceId,
        date: ymdFromDateLocal(row.offeredDate),
        time: normalizeWaitlistTime(row.offeredTime),
        sourceAppointmentId: null,
      })
    }
  }
}

export type FreedSlotPayload = {
  barberId: string
  serviceId: string
  date: string
  time: string
  /** Agendamento cancelado/removido que liberou o slot (para log). */
  sourceAppointmentId: string | null
}

/**
 * Notifica o próximo cliente (mesmo barbeiro + primeiro serviço do pacote) quando há vaga.
 */
export async function notifyNextWaitingForFreedSlot(
  barbershopId: string,
  freed: FreedSlotPayload
): Promise<string | null> {
  await expireStaleWaitlistNotifications(barbershopId)

  const next = await prisma.waitingListItem.findFirst({
    where: {
      barbershopId,
      status: "waiting",
      barberId: freed.barberId,
      serviceId: freed.serviceId,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  })

  if (!next) return null

  const offeredDate = parseAppointmentDate(freed.date)

  const row = await prisma.waitingListItem.update({
    where: { id: next.id },
    data: {
      status: "notified",
      notifiedAt: new Date(),
      offeredDate,
      offeredTime: normalizeWaitlistTime(freed.time),
    },
    select: { clientId: true },
  })

  await prisma.notificationLog.create({
    data: {
      barbershopId,
      clientId: row.clientId,
      appointmentId: freed.sourceAppointmentId,
      type: "push",
      event: "waiting_list_slot_available",
      payload: {
        date: freed.date,
        time: normalizeWaitlistTime(freed.time),
        service_id: freed.serviceId,
        barber_id: freed.barberId,
        waiting_list_item_id: next.id,
      },
    },
  })

  return next.id
}

export async function getWaitlistQueuePosition(args: {
  barbershopId: string
  barberId: string
  serviceId: string
  itemId: string
}): Promise<{ position: number; ahead: number } | null> {
  const item = await prisma.waitingListItem.findFirst({
    where: {
      id: args.itemId,
      barbershopId: args.barbershopId,
      barberId: args.barberId,
      serviceId: args.serviceId,
    },
    select: { id: true },
  })
  if (!item) return null

  const ordered = await prisma.waitingListItem.findMany({
    where: {
      barbershopId: args.barbershopId,
      barberId: args.barberId,
      serviceId: args.serviceId,
      status: { in: ["waiting", "notified"] },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  })

  const idx = ordered.findIndex((x) => x.id === args.itemId)
  if (idx < 0) return null
  return { position: idx + 1, ahead: idx }
}

/** Estimativa simples: posição × duração média do serviço (ou 15 min). */
export function estimateWaitMinutes(position: number, serviceDurationMinutes: number): number {
  const step = Math.max(15, Math.round(serviceDurationMinutes || 15))
  return Math.max(step, (position - 1) * step)
}
