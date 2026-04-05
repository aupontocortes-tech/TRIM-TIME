import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { hasFeature } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import type { BarbershopNotificationSettings, BarbershopSettings } from "@/lib/db/types"
import { renderNotificationTemplate, type NotificationTemplateVars } from "@/lib/notification-template"
import {
  sendWhatsAppByProvider,
  isWhatsAppIntegrationReady,
  type WhatsAppSendResult,
} from "@/lib/whatsapp-send-unified"

const DEFAULT_CONFIRM =
  "Olá {{nome_cliente}}, seu horário está confirmado para {{data}} às {{horario}}."
const DEFAULT_POST = "Obrigado pela preferência! Esperamos você novamente."

function formatDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  if (!y || !m || !d) return isoDate
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function templateVars(appt: {
  client: { name: string }
  service: { name: string }
  barbershop: { name: string }
  date: Date
  time: string
}): NotificationTemplateVars {
  const ymd = appt.date.toISOString().slice(0, 10)
  return {
    nome_cliente: appt.client.name,
    servico: appt.service.name,
    barbearia: appt.barbershop.name,
    data: formatDatePt(ymd),
    horario: appt.time.slice(0, 5),
  }
}

async function alreadySentSuccessfully(
  event: "appointment_confirmation" | "appointment_post_service",
  appointmentId: string
) {
  const logs = await prisma.notificationLog.findMany({
    where: { appointmentId, event },
    select: { payload: true },
    take: 50,
    orderBy: { sentAt: "desc" },
  })
  return logs.some((row) => {
    const w = (row.payload as Record<string, unknown> | null)?.whatsapp as WhatsAppSendResult | undefined
    return w?.ok === true
  })
}

/**
 * Confirmação por WhatsApp (novo agendamento). Não relança erro para não falhar o fluxo de agendamento.
 */
export async function trySendWhatsAppAppointmentConfirmation(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  try {
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) return
    if (await alreadySentSuccessfully("appointment_confirmation", appointmentId)) return

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId },
      include: { client: true, service: true, barbershop: true },
    })
    if (!appt || appt.status === "canceled") return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.whatsapp_send_confirmation === false) return

    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { barbershopId },
    })
    if (!isWhatsAppIntegrationReady(integration)) return

    const tpl = ns?.whatsapp_confirmation_template?.trim() || DEFAULT_CONFIRM
    const body = renderNotificationTemplate(tpl, templateVars(appt))
    const digits = (appt.client.phone ?? "").replace(/\D/g, "")
    if (digits.length < 10) return

    const result = await sendWhatsAppByProvider({
      integration: integration!,
      toDigits: digits,
      body,
    })
    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: appt.clientId,
        appointmentId,
        type: "whatsapp",
        event: "appointment_confirmation",
        payload: { whatsapp: result } as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.warn("[trySendWhatsAppAppointmentConfirmation]", e)
  }
}

/**
 * Mensagem pós-atendimento ao concluir o agendamento.
 */
export async function trySendWhatsAppAppointmentPostService(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  try {
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) return
    if (await alreadySentSuccessfully("appointment_post_service", appointmentId)) return

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId, status: "completed" },
      include: { client: true, service: true, barbershop: true },
    })
    if (!appt) return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.whatsapp_send_post_service === false) return

    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { barbershopId },
    })
    if (!isWhatsAppIntegrationReady(integration)) return

    const tpl = ns?.whatsapp_post_service_template?.trim() || DEFAULT_POST
    const body = renderNotificationTemplate(tpl, templateVars(appt))
    const digits = (appt.client.phone ?? "").replace(/\D/g, "")
    if (digits.length < 10) return

    const result = await sendWhatsAppByProvider({
      integration: integration!,
      toDigits: digits,
      body,
    })
    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: appt.clientId,
        appointmentId,
        type: "whatsapp",
        event: "appointment_post_service",
        payload: { whatsapp: result } as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.warn("[trySendWhatsAppAppointmentPostService]", e)
  }
}
