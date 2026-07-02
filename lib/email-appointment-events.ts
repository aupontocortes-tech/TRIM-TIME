import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { hasFeature } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"
import type { BarbershopNotificationSettings, BarbershopSettings } from "@/lib/db/types"
import { renderNotificationTemplate, type NotificationTemplateVars } from "@/lib/notification-template"
import { sendClientNotificationEmail, type ClientEmailSendResult } from "@/lib/client-notification-email"

const DEFAULT_CONFIRM =
  "Olá {{nome_cliente}}, seu horário está confirmado para {{data}} às {{horario}} na {{barbearia}}."
const DEFAULT_POST = "Obrigado pela preferência! Esperamos você novamente na {{barbearia}}."

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
      include: { client: true, service: true, barbershop: true },
    })
    if (!appt || appt.status === "canceled") return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.notify_email === false) return

    const email = appt.client.email?.trim()
    if (!email) return

    const tpl = ns?.email_confirmation_template?.trim() || DEFAULT_CONFIRM
    const body = renderNotificationTemplate(tpl, templateVars(appt))
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
      include: { client: true, service: true, barbershop: true },
    })
    if (!appt) return

    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns = settings as BarbershopNotificationSettings | undefined
    if (ns?.email_send_post_service === false) return

    const email = appt.client.email?.trim()
    if (!email) return

    const tpl = ns?.email_post_service_template?.trim() || DEFAULT_POST
    const body = renderNotificationTemplate(tpl, templateVars(appt))
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
