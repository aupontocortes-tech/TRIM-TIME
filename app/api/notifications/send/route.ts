import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireBarbershopId } from "@/lib/tenant"
import type { NotificationEvent, NotificationType } from "@/lib/db/types"

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const body = await request.json() as {
      barbershop_id: string
      client_id?: string
      appointment_id?: string
      type: NotificationType
      event: NotificationEvent
      payload?: Record<string, unknown>
    }
    if (body.barbershop_id !== barbershopId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
    }
    const supabase = createServiceRoleClient()
    await supabase.from("notification_log").insert({
      barbershop_id: body.barbershop_id,
      client_id: body.client_id ?? null,
      appointment_id: body.appointment_id ?? null,
      type: body.type,
      event: body.event,
      payload: body.payload ?? null,
    })
    // TODO: integrar com provedores reais (Firebase FCM, Resend/SendGrid, Meta WhatsApp API)
    // Por agora apenas logamos. Para push: verificar subscription do cliente; email: enviar template; WhatsApp: usar api_token da whatsapp_integrations
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar notificação" },
      { status: 500 }
    )
  }
}
