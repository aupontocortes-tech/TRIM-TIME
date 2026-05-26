import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireBarbershopId } from "@/lib/tenant"
import { hasFeature, getUpgradeMessage } from "@/lib/plans"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import {
  expireStaleWaitlistNotifications,
  notifyNextWaitingForFreedSlot,
  normalizeWaitlistTime,
} from "@/lib/waitlist-service"
import { waitlistApiInclude, mapWaitingListRowToApi } from "@/lib/waitlist-map"
import type { WaitingListStatus } from "@prisma/client"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const barbershopId = await requireBarbershopId()
    const plan = await resolveEffectivePlanForActiveSession(barbershopId)
    if (!plan || !hasFeature(plan, "waiting_list")) {
      return NextResponse.json({ error: getUpgradeMessage("waiting_list") }, { status: 403 })
    }
    await expireStaleWaitlistNotifications(barbershopId)

    const { id } = await params
    const body = await request.json() as {
      priority?: number
      status?: WaitingListStatus
      /** Ordenação manual: troca posição com outro item (mesmo barbeiro + serviço + status waiting). */
      swap_with_id?: string
    }

    const existing = await prisma.waitingListItem.findFirst({
      where: { id, barbershopId },
      select: {
        id: true,
        status: true,
        barberId: true,
        serviceId: true,
        priority: true,
        createdAt: true,
        offeredDate: true,
        offeredTime: true,
      },
    })
    if (!existing) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    if (body.swap_with_id && typeof body.swap_with_id === "string") {
      if (existing.status !== "waiting") {
        return NextResponse.json({ error: "Só é possível reordenar itens em espera" }, { status: 400 })
      }
      const other = await prisma.waitingListItem.findFirst({
        where: {
          id: body.swap_with_id.trim(),
          barbershopId,
          barberId: existing.barberId,
          serviceId: existing.serviceId,
          status: "waiting",
        },
        select: { id: true, priority: true, createdAt: true },
      })
      if (!other || other.id === existing.id) {
        return NextResponse.json({ error: "Outro item inválido para troca" }, { status: 400 })
      }
      await prisma.$transaction([
        prisma.waitingListItem.update({
          where: { id: existing.id },
          data: { priority: other.priority },
        }),
        prisma.waitingListItem.update({
          where: { id: other.id },
          data: { priority: existing.priority },
        }),
      ])
    } else {
      const patch: { priority?: number; status?: WaitingListStatus } = {}
      if (typeof body.priority === "number" && Number.isFinite(body.priority)) {
        patch.priority = Math.round(body.priority)
      }
      if (body.status !== undefined) {
        if (body.status !== "canceled") {
          return NextResponse.json({ error: "Use apenas status canceled para remover da fila" }, { status: 400 })
        }
        if (existing.status !== "waiting" && existing.status !== "notified") {
          return NextResponse.json({ error: "Item já finalizado na fila" }, { status: 400 })
        }
        patch.status = "canceled"
      }
      if (Object.keys(patch).length > 0) {
        await prisma.waitingListItem.update({
          where: { id: existing.id },
          data: patch,
        })
      }

      if (
        patch.status === "canceled" &&
        existing.status === "notified" &&
        existing.offeredDate &&
        existing.offeredTime
      ) {
        const ymd = `${existing.offeredDate.getFullYear()}-${String(existing.offeredDate.getMonth() + 1).padStart(2, "0")}-${String(existing.offeredDate.getDate()).padStart(2, "0")}`
        await notifyNextWaitingForFreedSlot(barbershopId, {
          barberId: existing.barberId,
          serviceId: existing.serviceId,
          date: ymd,
          time: normalizeWaitlistTime(String(existing.offeredTime ?? "")),
          sourceAppointmentId: null,
        })
      }
    }

    const row = await prisma.waitingListItem.findFirst({
      where: { id, barbershopId },
      include: waitlistApiInclude,
    })
    if (!row) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    return NextResponse.json(mapWaitingListRowToApi(row))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
