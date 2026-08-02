import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { publicBookingUrl } from "@/lib/booking-public-url"
import { buildAppointmentNotificationVars } from "@/lib/appointment-notification-vars"
import { buildWaitlistConfirmUrl } from "@/lib/waitlist-confirm-token"
import {
  getWaitlistAcceptDeadlineMinutes,
  normalizeWaitlistTime,
} from "@/lib/waitlist-service"
import { acceptWaitlistOffer } from "@/lib/waitlist-accept-core"
import { hasFeature } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"

function formatDatePt(date: Date): string {
  const ymd = date.toISOString().slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

type ActionParams = {
  barbershopId: string
  barbershopName: string
  slug: string
  senderPhone: string
  settings: BarbershopSettings | null | undefined
}

export async function buildCancelarRemarcarText(params: ActionParams): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)

  if (!client) {
    return link
      ? `Não encontramos cadastro com este número.\nPara agendar, acesse:\n${link}`
      : "Não encontramos cadastro com este número."
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const next = await prisma.appointment.findFirst({
    where: {
      barbershopId: params.barbershopId,
      clientId: client.id,
      status: { in: ["pending", "confirmed"] },
      date: { gte: now },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: { service: true, barber: { include: { unit: true } }, unit: true },
  })

  if (!next) {
    return link
      ? `Olá ${client.name}! Não há agendamento futuro para cancelar ou remarcar.\nPara marcar, acesse:\n${link}`
      : `Olá ${client.name}! Não há agendamento futuro para cancelar ou remarcar.`
  }

  const vars = buildAppointmentNotificationVars({
    client: { name: client.name },
    service: { name: next.service.name },
    barbershop: { name: params.barbershopName, settings: params.settings },
    barber: { name: next.barber.name, unit: next.barber.unit },
    unit: next.unit,
    date: next.date,
    time: next.time,
  })

  return [
    `Olá ${vars.nome_cliente}! Seu horário: ${vars.data} às ${vars.horario} — ${vars.servico}.`,
    "",
    "Para cancelar ou remarcar, acesse o app (entre com seu número):",
    link,
  ].join("\n")
}

export async function buildListaEsperaText(params: ActionParams): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const plan = await resolveEffectivePlanForBarbershop(params.barbershopId)
  if (!plan || !hasFeature(plan, "waiting_list")) {
    return link
      ? `A lista de espera não está ativa nesta barbearia.\nPara agendar, acesse:\n${link}`
      : "A lista de espera não está ativa nesta barbearia."
  }

  const client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)
  if (!client) {
    return link
      ? `Para entrar na lista de espera ou agendar, acesse:\n${link}`
      : "Para usar a lista de espera, faça um agendamento pelo app."
  }

  const items = await prisma.waitingListItem.findMany({
    where: {
      barbershopId: params.barbershopId,
      clientId: client.id,
      status: { in: ["waiting", "notified"] },
    },
    orderBy: { updatedAt: "desc" },
    include: { service: true, barber: true },
  })

  if (items.length === 0) {
    return link
      ? `Olá ${client.name}! Você não está na lista de espera.\nPara entrar ou agendar, acesse:\n${link}`
      : `Olá ${client.name}! Você não está na lista de espera.`
  }

  const notified = items.find((i) => i.status === "notified")
  if (notified?.offeredDate && notified.offeredTime) {
    const deadline = getWaitlistAcceptDeadlineMinutes(params.settings)
    const confirmLink = buildWaitlistConfirmUrl(params.slug, notified.id)
    const date = formatDatePt(notified.offeredDate)
    const time = normalizeWaitlistTime(notified.offeredTime)
    return [
      `Olá ${client.name}! Temos uma vaga para você:`,
      `${date} às ${time} — ${notified.service.name} com ${notified.barber.name}.`,
      "",
      `Confirme em até ${deadline} minutos (clique no link):`,
      confirmLink,
    ].join("\n")
  }

  const waiting = items.find((i) => i.status === "waiting")
  if (waiting) {
    const parts = [`Olá ${client.name}! Você está na lista de espera (${waiting.service.name}).`]
    if (waiting.desiredDate) {
      parts.push(`Preferência: ${formatDatePt(waiting.desiredDate)}`)
    }
    parts.push("", "Quando abrir vaga, avisamos por aqui com link para confirmar.")
    if (link) parts.push("", `App: ${link}`)
    return parts.join("\n")
  }

  return link ? `Acesse:\n${link}` : "Entre em contato com a barbearia."
}

/** Confirma vaga da lista de espera ou agendamento pendente; responde texto para o cliente. */
export async function buildConfirmarRespostaText(params: ActionParams): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)

  if (!client) {
    return link
      ? `Não encontramos cadastro com este número.\nPara agendar, acesse:\n${link}`
      : "Não encontramos cadastro com este número."
  }

  const plan = await resolveEffectivePlanForBarbershop(params.barbershopId)
  const waitlistEnabled = Boolean(plan && hasFeature(plan, "waiting_list"))

  if (waitlistEnabled) {
    const notified = await prisma.waitingListItem.findFirst({
      where: {
        barbershopId: params.barbershopId,
        clientId: client.id,
        status: "notified",
      },
      orderBy: { notifiedAt: "desc" },
      include: { service: true, barber: true },
    })

    if (notified) {
      const accepted = await acceptWaitlistOffer({
        barbershopId: params.barbershopId,
        itemId: notified.id,
        clientId: client.id,
        settings: params.settings,
      })

      if (accepted.ok) {
        const date = notified.offeredDate ? formatDatePt(notified.offeredDate) : ""
        const time = notified.offeredTime ? normalizeWaitlistTime(notified.offeredTime) : ""
        return [
          `Pronto, ${client.name}! Vaga confirmada.`,
          date && time
            ? `${date} às ${time} — ${notified.service.name} com ${notified.barber.name}.`
            : `${notified.service.name} com ${notified.barber.name}.`,
          "",
          "Te esperamos!",
        ]
          .filter(Boolean)
          .join("\n")
      }

      const confirmLink = buildWaitlistConfirmUrl(params.slug, notified.id)
      const deadline = getWaitlistAcceptDeadlineMinutes(params.settings)
      return [
        `Olá ${client.name}! Não foi possível confirmar automaticamente.`,
        accepted.error,
        "",
        `Tente pelo link (válido por ~${deadline} min após o aviso):`,
        confirmLink,
      ].join("\n")
    }
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const pending = await prisma.appointment.findFirst({
    where: {
      barbershopId: params.barbershopId,
      clientId: client.id,
      status: "pending",
      date: { gte: now },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: { service: true, barber: { include: { unit: true } }, unit: true },
  })

  if (pending) {
    await prisma.appointment.update({
      where: { id: pending.id },
      data: { status: "confirmed" },
    })

    const vars = buildAppointmentNotificationVars({
      client: { name: client.name },
      service: { name: pending.service.name },
      barbershop: { name: params.barbershopName, settings: params.settings },
      barber: { name: pending.barber.name, unit: pending.barber.unit },
      unit: pending.unit,
      date: pending.date,
      time: pending.time,
    })

    return [
      `Confirmado, ${vars.nome_cliente}!`,
      `${vars.data} às ${vars.horario} — ${vars.servico} com ${vars.barbeiro}.`,
      "",
      "Te esperamos!",
    ].join("\n")
  }

  const confirmed = await prisma.appointment.findFirst({
    where: {
      barbershopId: params.barbershopId,
      clientId: client.id,
      status: "confirmed",
      date: { gte: now },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    include: { service: true, barber: { include: { unit: true } }, unit: true },
  })

  if (confirmed) {
    const vars = buildAppointmentNotificationVars({
      client: { name: client.name },
      service: { name: confirmed.service.name },
      barbershop: { name: params.barbershopName, settings: params.settings },
      barber: { name: confirmed.barber.name, unit: confirmed.barber.unit },
      unit: confirmed.unit,
      date: confirmed.date,
      time: confirmed.time,
    })

    return [
      `Olá ${vars.nome_cliente}! Seu horário já está confirmado:`,
      `${vars.data} às ${vars.horario} — ${vars.servico} com ${vars.barbeiro}.`,
    ].join("\n")
  }

  return link
    ? `Olá ${client.name}! Não há horário ou vaga pendente de confirmação.\nPara agendar, acesse:\n${link}`
    : `Olá ${client.name}! Não há horário ou vaga pendente de confirmação.`
}
