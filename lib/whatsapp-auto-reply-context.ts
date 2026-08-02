import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { buildAppointmentNotificationVars } from "@/lib/appointment-notification-vars"
import { publicBookingUrl } from "@/lib/booking-public-url"
import { formatUnitAddressLine } from "@/lib/unit-picker-accent"
import { renderNotificationTemplate } from "@/lib/notification-template"
import type { NotificationTemplateVars } from "@/lib/notification-template"

function formatDatePt(date: Date): string {
  const ymd = date.toISOString().slice(0, 10)
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function shopAddressLine(settings: BarbershopSettings | null | undefined): string {
  return formatUnitAddressLine({
    address: settings?.address ?? null,
    city: settings?.city ?? null,
    state: settings?.state ?? null,
    cep: settings?.cep ?? null,
    maps_url: settings?.maps_url ?? null,
  })
}

function shopMapsLine(settings: BarbershopSettings | null | undefined): string {
  const url = settings?.maps_url?.trim()
  return url ? `Como chegar: ${url}` : ""
}

async function buildProximoAgendamentoText(params: {
  barbershopId: string
  barbershopName: string
  slug: string
  senderPhone: string
  settings: BarbershopSettings | null | undefined
}): Promise<string> {
  const client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)
  const link = publicBookingUrl(params.slug)

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
    include: {
      service: true,
      barber: { include: { unit: true } },
      unit: true,
      barbershop: true,
    },
  })

  if (!next) {
    return link
      ? `Olá ${client.name}! Não encontramos agendamento futuro para este número.\nPara marcar, acesse:\n${link}`
      : `Olá ${client.name}! Não encontramos agendamento futuro para este número.`
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

  const lines = [
    `Olá ${vars.nome_cliente}! Seu próximo horário:`,
    `${vars.data} às ${vars.horario} — ${vars.servico} com ${vars.barbeiro}.`,
  ]
  if (vars.unidade) lines.push(vars.unidade)
  if (vars.endereco) lines.push(vars.endereco)
  if (vars.maps) lines.push(vars.maps)
  return lines.filter(Boolean).join("\n")
}

async function buildListaUnidadesText(params: {
  barbershopId: string
  barbershopName: string
  settings: BarbershopSettings | null | undefined
}): Promise<string> {
  const units = await prisma.barbershopUnit.findMany({
    where: { barbershopId: params.barbershopId, active: true },
    orderBy: { name: "asc" },
    select: {
      name: true,
      address: true,
      city: true,
      state: true,
      cep: true,
      mapsUrl: true,
    },
  })

  if (units.length <= 1) {
    const endereco = shopAddressLine(params.settings)
    const maps = shopMapsLine(params.settings)
    const lines = [params.barbershopName]
    if (endereco) lines.push(endereco)
    if (maps) lines.push(maps)
    return lines.join("\n")
  }

  return units
    .map((u, i) => {
      const endereco = formatUnitAddressLine({
        address: u.address,
        city: u.city,
        state: u.state,
        cep: u.cep,
        maps_url: u.mapsUrl,
      })
      const maps = u.mapsUrl?.trim() ? `Como chegar: ${u.mapsUrl.trim()}` : ""
      return [`${i + 1}. ${u.name}`, endereco, maps].filter(Boolean).join("\n")
    })
    .join("\n\n")
}

/** Variáveis extras para respostas automáticas por palavra-chave. */
export type WhatsAppAutoReplyContextVars = NotificationTemplateVars & {
  proximo_agendamento: string
  lista_unidades: string
  link_agendamento: string
}

export async function buildWhatsAppAutoReplyContext(params: {
  barbershopId: string
  barbershopName: string
  slug: string
  senderPhone: string
  senderName?: string | null
  settings: BarbershopSettings | null | undefined
}): Promise<WhatsAppAutoReplyContextVars> {
  const settings = params.settings
  const client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)
  const endereco = shopAddressLine(settings)
  const maps = shopMapsLine(settings)
  const link = publicBookingUrl(params.slug)

  const base: NotificationTemplateVars = {
    nome_cliente: client?.name ?? params.senderName?.trim() ?? "Cliente",
    data: formatDatePt(new Date()),
    horario: "",
    servico: "",
    barbearia: params.barbershopName,
    unidade: params.barbershopName,
    endereco,
    maps,
    barbeiro: "",
  }

  const [proximo_agendamento, lista_unidades] = await Promise.all([
    buildProximoAgendamentoText(params),
    buildListaUnidadesText(params),
  ])

  return {
    ...base,
    proximo_agendamento,
    lista_unidades,
    link_agendamento: link,
  }
}

export function renderWhatsAppAutoReplyTemplate(
  template: string,
  vars: WhatsAppAutoReplyContextVars
): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value ?? "")
  }
  return renderNotificationTemplate(out, vars).trim()
}
