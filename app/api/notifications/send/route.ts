import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { requireBarbershopId } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { NotificationEvent, NotificationType } from "@/lib/db/types"

/**
 * Registra notificação no banco (Prisma). O envio ativo de lembretes agendados roda em
 * GET /api/cron/appointment-reminders com CRON_SECRET.
 */
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
    await prisma.notificationLog.create({
      data: {
        barbershopId: body.barbershop_id,
        clientId: body.client_id ?? null,
        appointmentId: body.appointment_id ?? null,
        type: body.type,
        event: body.event,
        payload: (body.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar notificação" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
