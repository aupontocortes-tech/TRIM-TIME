import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildAppointmentNotificationVars } from "@/lib/appointment-notification-vars"
import type { BarbershopNotificationSettings, BarbershopSettings } from "@/lib/db/types"
import {
  DEFAULT_APP_CONFIRMATION,
  DEFAULT_APP_POST_SERVICE,
} from "@/lib/notification-default-templates"
import { renderNotificationTemplate } from "@/lib/notification-template"
import { sendWebPushToClient } from "@/lib/web-push-send"

const APPOINTMENT_INCLUDE = {
  client: true,
  service: true,
  barbershop: true,
  barber: { include: { unit: true } },
  unit: true,
} as const

function resolveConfirmationTemplate(ns: BarbershopNotificationSettings | undefined): string {
  return (
    ns?.app_confirmation_template?.trim() ||
    ns?.email_confirmation_template?.trim() ||
    ns?.whatsapp_confirmation_template?.trim() ||
    DEFAULT_APP_CONFIRMATION
  )
}

function resolvePostServiceTemplate(ns: BarbershopNotificationSettings | undefined): string {
  return (
    ns?.app_post_service_template?.trim() ||
    ns?.email_post_service_template?.trim() ||
    ns?.whatsapp_post_service_template?.trim() ||
    DEFAULT_APP_POST_SERVICE
  )
}

function bookingUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""
  return base ? `${base}/b/${slug}` : `/b/${slug}`
}

async function alreadySentPushSuccessfully(
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
    const push = (row.payload as Record<string, unknown> | null)?.push as { ok?: boolean } | undefined
    return push?.ok === true
  })
}

/**
 * Push de confirmação ao criar agendamento (PWA do cliente).
 * Reutiliza o texto de confirmação do app, e-mail ou WhatsApp já configurado.
 */
export async function trySendPushAppointmentConfirmation(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  try {
    if (await alreadySentPushSuccessfully("appointment_confirmation", appointmentId)) return

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId },
      include: APPOINTMENT_INCLUDE,
    })
    if (!appt || appt.status === "canceled") return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.notify_app === false) return
    if (ns?.app_send_confirmation === false) return
    if (!appt.client.pushSubscription) return

    const tpl = resolveConfirmationTemplate(ns)
    const body = renderNotificationTemplate(tpl, buildAppointmentNotificationVars(appt))
    const result = await sendWebPushToClient(appt.client.pushSubscription, {
      title: `Agendamento confirmado — ${appt.barbershop.name}`,
      body,
      url: bookingUrl(appt.barbershop.slug),
    })

    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: appt.clientId,
        appointmentId,
        type: "push",
        event: "appointment_confirmation",
        payload: { push: result } as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.warn("[trySendPushAppointmentConfirmation]", e)
  }
}

/**
 * Push pós-atendimento ao marcar agendamento como concluído.
 */
export async function trySendPushAppointmentPostService(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  try {
    if (await alreadySentPushSuccessfully("appointment_post_service", appointmentId)) return

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId, status: "completed" },
      include: APPOINTMENT_INCLUDE,
    })
    if (!appt) return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.notify_app === false) return
    if (ns?.app_send_post_service === false) return
    if (!appt.client.pushSubscription) return

    const tpl = resolvePostServiceTemplate(ns)
    const body = renderNotificationTemplate(tpl, buildAppointmentNotificationVars(appt))
    const result = await sendWebPushToClient(appt.client.pushSubscription, {
      title: appt.barbershop.name,
      body,
      url: bookingUrl(appt.barbershop.slug),
    })

    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: appt.clientId,
        appointmentId,
        type: "push",
        event: "appointment_post_service",
        payload: { push: result } as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.warn("[trySendPushAppointmentPostService]", e)
  }
}
