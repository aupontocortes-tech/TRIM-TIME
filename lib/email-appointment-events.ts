import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { hasFeature } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import type { BarbershopNotificationSettings, BarbershopSettings } from "@/lib/db/types"
import { buildAppointmentNotificationVars } from "@/lib/appointment-notification-vars"
import {
  DEFAULT_EMAIL_CONFIRMATION,
  DEFAULT_EMAIL_POST_SERVICE,
} from "@/lib/notification-default-templates"
import { renderNotificationTemplate } from "@/lib/notification-template"
import { sendClientNotificationEmail, type ClientEmailSendResult } from "@/lib/client-notification-email"

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
    const e = (row.payload as Record<string, unknown> | null)?.email as ClientEmailSendResult | undefined
    return e?.ok === true
  })
}

export async function trySendEmailAppointmentConfirmation(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  try {
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "email_notifications")) return
    if (await alreadySentSuccessfully("appointment_confirmation", appointmentId)) return

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId },
      include: APPOINTMENT_INCLUDE,
    })
    if (!appt || appt.status === "canceled") return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.notify_email === false) return

    const email = appt.client.email?.trim()
    if (!email) return

    const tpl = ns?.email_confirmation_template?.trim() || DEFAULT_EMAIL_CONFIRMATION
    const body = renderNotificationTemplate(tpl, buildAppointmentNotificationVars(appt))
    const result = await sendClientNotificationEmail({
      to: email,
      subject: `Agendamento confirmado — ${appt.barbershop.name}`,
      bodyText: body,
      barbershopName: appt.barbershop.name,
    })

    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: appt.clientId,
        appointmentId,
        type: "email",
        event: "appointment_confirmation",
        payload: { email: result } as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.warn("[trySendEmailAppointmentConfirmation]", e)
  }
}

export async function trySendEmailAppointmentPostService(
  barbershopId: string,
  appointmentId: string
): Promise<void> {
  try {
    const plan = await resolveEffectivePlanForBarbershop(barbershopId)
    if (!plan || !hasFeature(plan, "email_notifications")) return
    if (await alreadySentSuccessfully("appointment_post_service", appointmentId)) return

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId, status: "completed" },
      include: APPOINTMENT_INCLUDE,
    })
    if (!appt) return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.email_send_post_service === false) return

    const email = appt.client.email?.trim()
    if (!email) return

    const tpl = ns?.email_post_service_template?.trim() || DEFAULT_EMAIL_POST_SERVICE
    const body = renderNotificationTemplate(tpl, buildAppointmentNotificationVars(appt))
    const result = await sendClientNotificationEmail({
      to: email,
      subject: `Obrigado pela visita — ${appt.barbershop.name}`,
      bodyText: body,
      barbershopName: appt.barbershop.name,
    })

    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: appt.clientId,
        appointmentId,
        type: "email",
        event: "appointment_post_service",
        payload: { email: result } as Prisma.InputJsonValue,
      },
    })
  } catch (e) {
    console.warn("[trySendEmailAppointmentPostService]", e)
  }
}
