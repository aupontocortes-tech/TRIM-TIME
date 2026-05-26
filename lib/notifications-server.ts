/**
 * Registra em notification_log (Prisma). Envio ativo: ver processAppointmentReminders + cron.
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { NotificationEvent, NotificationType } from "@/lib/db/types"

export type NotifyPayload = {
  barbershop_id: string
  client_id?: string
  appointment_id?: string
  type: NotificationType
  event: NotificationEvent
  payload?: Record<string, unknown>
}

export async function logNotification(payload: NotifyPayload): Promise<void> {
  await prisma.notificationLog.create({
    data: {
      barbershopId: payload.barbershop_id,
      clientId: payload.client_id ?? null,
      appointmentId: payload.appointment_id ?? null,
      type: payload.type,
      event: payload.event,
      payload: (payload.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}
