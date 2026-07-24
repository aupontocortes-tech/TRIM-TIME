import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { hasFeature } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import type { BarbershopNotificationSettings, BarbershopSettings } from "@/lib/db/types"
import { buildAppointmentNotificationVars } from "@/lib/appointment-notification-vars"
import {
  DEFAULT_WHATSAPP_CONFIRMATION,
  DEFAULT_WHATSAPP_POST_SERVICE,
} from "@/lib/notification-default-templates"
import { renderNotificationTemplate } from "@/lib/notification-template"
import {
  sendWhatsAppNotification,
  isWhatsAppIntegrationReady,
  type WhatsAppSendResult,
} from "@/lib/whatsapp-send-unified"
import { metaTemplateBodyParamsFromVars } from "@/lib/whatsapp-meta-templates"

const APPOINTMENT_INCLUDE = {
  client: true,
  service: true,
  barbershop: true,
  barber: { include: { unit: true } },
  unit: true,
} as const

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
  appointmentId: string,
  options?: { allowResend?: boolean }
): Promise<void> {
  try {
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) return
    if (
      !options?.allowResend &&
      (await alreadySentSuccessfully("appointment_confirmation", appointmentId))
    ) {
      return
    }

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId },
      include: APPOINTMENT_INCLUDE,
    })
    if (!appt || appt.status === "canceled") return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.whatsapp_send_confirmation === false) return

    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { barbershopId },
    })
    if (!isWhatsAppIntegrationReady(integration)) return

    const tpl = ns?.whatsapp_confirmation_template?.trim() || DEFAULT_WHATSAPP_CONFIRMATION
    const vars = buildAppointmentNotificationVars(appt)
    const body = renderNotificationTemplate(tpl, vars)
    const digits = (appt.client.phone ?? "").replace(/\D/g, "")
    if (digits.length < 10) return

    const result = await sendWhatsAppNotification({
      integration: integration!,
      toDigits: digits,
      body,
      metaTemplateName: ns?.whatsapp_meta_template_confirmation,
      metaTemplateBodyParams: metaTemplateBodyParamsFromVars(vars),
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
      include: APPOINTMENT_INCLUDE,
    })
    if (!appt) return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.whatsapp_send_post_service === false) return

    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { barbershopId },
    })
    if (!isWhatsAppIntegrationReady(integration)) return

    const tpl = ns?.whatsapp_post_service_template?.trim() || DEFAULT_WHATSAPP_POST_SERVICE
    const vars = buildAppointmentNotificationVars(appt)
    const body = renderNotificationTemplate(tpl, vars)
    const digits = (appt.client.phone ?? "").replace(/\D/g, "")
    if (digits.length < 10) return

    const result = await sendWhatsAppNotification({
      integration: integration!,
      toDigits: digits,
      body,
      metaTemplateName: ns?.whatsapp_meta_template_post_service,
      metaTemplateBodyParams: metaTemplateBodyParamsFromVars(vars),
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
