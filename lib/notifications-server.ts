/**
 * Helpers de notificação para uso em API routes / Server Actions.
 * Registra em notification_log; integração com FCM/Email/WhatsApp pode ser feita aqui ou em worker.
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
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
  const supabase = createServiceRoleClient()
  await supabase.from("notification_log").insert({
    barbershop_id: payload.barbershop_id,
    client_id: payload.client_id ?? null,
    appointment_id: payload.appointment_id ?? null,
    type: payload.type,
    event: payload.event,
    payload: payload.payload ?? null,
  })
}
