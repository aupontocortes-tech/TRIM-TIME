/**
 * Serviço de notificações - Trim Time
 * Push (in-app), Email e WhatsApp (Premium).
 * Registra em notification_log e delega para provedores externos.
 */

import type { NotificationType, NotificationEvent } from "./db/types"

export type NotificationPayload = {
  barbershop_id: string
  client_id?: string
  appointment_id?: string
  type: NotificationType
  event: NotificationEvent
  payload?: Record<string, unknown>
}

/** Enfileira/envia notificação. Em produção: fila (ex: Inngest, Bull) + workers. */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const res = await fetch(
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`
      : "/api/notifications/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Falha ao enviar notificação")
  }
}

/** Confirmação de agendamento: push + email (+ WhatsApp se Premium) */
export function sendAppointmentConfirmation(params: {
  barbershop_id: string
  client_id: string
  appointment_id: string
  clientEmail?: string | null
  clientPhone?: string | null
  hasWhatsApp: boolean
}) {
  return sendNotification({
    barbershop_id: params.barbershop_id,
    client_id: params.client_id,
    appointment_id: params.appointment_id,
    type: "push",
    event: "appointment_confirmation",
    payload: {
      email: params.clientEmail,
      phone: params.clientPhone,
      send_email: true,
      send_whatsapp: params.hasWhatsApp,
    },
  })
}

/** Lembrete de horário: push + email (+ WhatsApp se Premium) */
export function sendAppointmentReminder(params: {
  barbershop_id: string
  client_id: string
  appointment_id: string
  clientEmail?: string | null
  clientPhone?: string | null
  hasWhatsApp: boolean
}) {
  return sendNotification({
    barbershop_id: params.barbershop_id,
    client_id: params.client_id,
    appointment_id: params.appointment_id,
    type: "push",
    event: "appointment_reminder",
    payload: {
      email: params.clientEmail,
      phone: params.clientPhone,
      send_email: true,
      send_whatsapp: params.hasWhatsApp,
    },
  })
}

/** Cancelamento: push */
export function sendAppointmentCanceled(params: {
  barbershop_id: string
  client_id: string
  appointment_id: string
}) {
  return sendNotification({
    barbershop_id: params.barbershop_id,
    client_id: params.client_id,
    appointment_id: params.appointment_id,
    type: "push",
    event: "appointment_canceled",
  })
}
