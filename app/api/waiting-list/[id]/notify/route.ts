import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { normalizeWaitlistTime } from "@/lib/waitlist-service"

/**
 * Reenvia registro de notificação (push/log) para o cliente — útil se o SMS/WhatsApp
 * ainda não estiver integrado e o dono quiser “pingar” de novo.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: getUpgradeMessage("waiting_list") }, { status: 403 })
    }

    const { id } = await params
    const row = await prisma.waitingListItem.findFirst({
      where: { id, barbershopId },
      select: {
        id: true,
        clientId: true,
        status: true,
        serviceId: true,
        barberId: true,
        offeredDate: true,
        offeredTime: true,
        desiredDate: true,
        desiredTime: true,
      },
    })

    if (!row) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    if (row.status !== "waiting" && row.status !== "notified") {
      return NextResponse.json({ error: "Só é possível notificar itens aguardando ou já notificados" }, { status: 400 })
    }

    const refDate = row.offeredDate ?? row.desiredDate
    const refTime = row.offeredTime ?? row.desiredTime
    const dateStr = refDate
      ? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(refDate.getDate()).padStart(2, "0")}`
      : null

    await prisma.notificationLog.create({
      data: {
        barbershopId,
        clientId: row.clientId,
        appointmentId: null,
        type: "push",
        event: "waiting_list_slot_available",
        payload: {
          manual_resend: true,
          waiting_list_item_id: row.id,
          date: dateStr,
          time: refTime ? normalizeWaitlistTime(String(refTime)) : null,
          service_id: row.serviceId,
          barber_id: row.barberId,
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao notificar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
