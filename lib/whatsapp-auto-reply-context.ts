import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import { buildAppointmentNotificationVars } from "@/lib/appointment-notification-vars"
import { publicBookingUrl } from "@/lib/booking-public-url"
import { formatUnitAddressLine } from "@/lib/unit-picker-accent"
import { renderNotificationTemplate } from "@/lib/notification-template"
import type { NotificationTemplateVars } from "@/lib/notification-template"
import { formatOpeningHoursText, formatServicesListText } from "@/lib/whatsapp-auto-reply-format"
import {
  buildCancelarRemarcarText,
  buildConfirmarRespostaText,
  buildListaEsperaText,
} from "@/lib/whatsapp-auto-reply-actions"

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

type SenderAppointmentParams = {
  barbershopId: string
  barbershopName: string
  slug: string
  senderPhone: string
  settings: BarbershopSettings | null | undefined
}

async function findNextClientAppointment(params: SenderAppointmentParams) {
  const client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)
  if (!client) return { client: null, next: null }

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

  return { client, next }
}

type ClientAppointmentLookup = Awaited<ReturnType<typeof findNextClientAppointment>>

async function buildProximoAgendamentoText(
  params: SenderAppointmentParams,
  lookup?: ClientAppointmentLookup
): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const { client, next } = lookup ?? (await findNextClientAppointment(params))

  if (!client) {
    return link
      ? `Não encontramos cadastro com este número.\nPara agendar, acesse:\n${link}`
      : "Não encontramos cadastro com este número."
  }

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

async function buildProfissionalAgendamentoText(
  params: SenderAppointmentParams,
  lookup?: ClientAppointmentLookup
): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const { client, next } = lookup ?? (await findNextClientAppointment(params))

  if (!client) {
    return link
      ? `Não encontramos cadastro com este número.\nPara agendar, acesse:\n${link}`
      : "Não encontramos cadastro com este número."
  }

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
    `Olá ${vars.nome_cliente}! Quem vai te atender:`,
    `${vars.barbeiro} — ${vars.data} às ${vars.horario} (${vars.servico}).`,
  ]
  if (vars.unidade) lines.push(vars.unidade)
  return lines.filter(Boolean).join("\n")
}

async function buildListaProfissionaisText(params: {
  barbershopId: string
  slug: string
}): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const barbers = await prisma.barber.findMany({
    where: { barbershopId: params.barbershopId, active: true },
    orderBy: { name: "asc" },
    select: { name: true, unit: { select: { name: true } } },
  })

  if (barbers.length === 0) {
    return link
      ? `No momento não há profissionais cadastrados.\nPara agendar, acesse:\n${link}`
      : "No momento não há profissionais cadastrados."
  }

  const lines = barbers.map((b, i) => {
    const unit = b.unit?.name?.trim()
    return unit ? `${i + 1}. ${b.name} — ${unit}` : `${i + 1}. ${b.name}`
  })

  const header = barbers.length === 1 ? "Profissional:" : "Profissionais:"
  const footer = link
    ? "\n\nPara ver horários livres e escolher profissional, acesse:\n" + link
    : ""
  return `${header}\n${lines.join("\n")}${footer}`
}

async function buildListaServicosText(params: {
  barbershopId: string
  slug: string
}): Promise<string> {
  const link = publicBookingUrl(params.slug)
  const services = await prisma.service.findMany({
    where: { barbershopId: params.barbershopId, active: true },
    orderBy: { name: "asc" },
    select: { name: true, price: true, duration: true },
  })

  const list = formatServicesListText(
    services.map((s) => ({ name: s.name, price: Number(s.price), duration: s.duration }))
  )
  const footer = link ? `\n\nPara agendar:\n${link}` : ""
  return `Serviços e valores:\n${list}${footer}`
}

async function buildHorarioFuncionamentoText(
  settings: BarbershopSettings | null | undefined
): Promise<string> {
  return `Horário de funcionamento:\n${formatOpeningHoursText(settings)}`
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
  profissional_agendamento: string
  lista_profissionais: string
  lista_servicos: string
  horario_funcionamento: string
  cancelar_remarcar: string
  lista_espera: string
  confirmar_resposta: string
  lista_unidades: string
  link_agendamento: string
}

function templateNeeds(template: string, key: string): boolean {
  return template.includes(`{{${key}}}`)
}

export async function buildWhatsAppAutoReplyContext(
  params: {
    barbershopId: string
    barbershopName: string
    slug: string
    senderPhone: string
    senderName?: string | null
    settings: BarbershopSettings | null | undefined
  },
  replyTemplate: string
): Promise<WhatsAppAutoReplyContextVars> {
  const settings = params.settings
  const lookup = templateNeeds(replyTemplate, "proximo_agendamento") ||
    templateNeeds(replyTemplate, "profissional_agendamento") ||
    templateNeeds(replyTemplate, "nome_cliente") ||
    templateNeeds(replyTemplate, "barbeiro")
    ? await findNextClientAppointment(params)
    : { client: null as Awaited<ReturnType<typeof findClientByPhoneDigits>>, next: null }

  let client = lookup.client
  if (
    !client &&
    (templateNeeds(replyTemplate, "nome_cliente") ||
      templateNeeds(replyTemplate, "cancelar_remarcar") ||
      templateNeeds(replyTemplate, "lista_espera") ||
      templateNeeds(replyTemplate, "confirmar_resposta"))
  ) {
    client = await findClientByPhoneDigits(params.barbershopId, params.senderPhone)
  }

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
    barbeiro: lookup.next?.barber.name ?? "",
  }

  const actionParams = {
    barbershopId: params.barbershopId,
    barbershopName: params.barbershopName,
    slug: params.slug,
    senderPhone: params.senderPhone,
    settings,
  }

  const emptyExtras = {
    proximo_agendamento: "",
    profissional_agendamento: "",
    lista_profissionais: "",
    lista_servicos: "",
    horario_funcionamento: "",
    cancelar_remarcar: "",
    lista_espera: "",
    confirmar_resposta: "",
    lista_unidades: "",
    link_agendamento: link,
  }

  const [proximo_agendamento, profissional_agendamento, lista_profissionais, lista_servicos, horario_funcionamento, cancelar_remarcar, lista_espera, confirmar_resposta, lista_unidades] =
    await Promise.all([
      templateNeeds(replyTemplate, "proximo_agendamento")
        ? buildProximoAgendamentoText(params, lookup)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "profissional_agendamento")
        ? buildProfissionalAgendamentoText(params, lookup)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "lista_profissionais")
        ? buildListaProfissionaisText(params)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "lista_servicos")
        ? buildListaServicosText(params)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "horario_funcionamento")
        ? buildHorarioFuncionamentoText(settings)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "cancelar_remarcar")
        ? buildCancelarRemarcarText(actionParams)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "lista_espera")
        ? buildListaEsperaText(actionParams)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "confirmar_resposta")
        ? buildConfirmarRespostaText(actionParams)
        : Promise.resolve(""),
      templateNeeds(replyTemplate, "lista_unidades")
        ? buildListaUnidadesText(params)
        : Promise.resolve(""),
    ])

  return {
    ...base,
    ...emptyExtras,
    proximo_agendamento,
    profissional_agendamento,
    lista_profissionais,
    lista_servicos,
    horario_funcionamento,
    cancelar_remarcar,
    lista_espera,
    confirmar_resposta,
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
