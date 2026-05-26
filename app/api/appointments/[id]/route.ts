import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { hasBarberSlotConflict } from "@/lib/scheduling"
import { saleCommissionAmount } from "@/lib/commissions"
import { resolveSelectedUnitId } from "@/lib/unit-context"
import type { Appointment, AppointmentStatus } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import {
  appointmentApiInclude,
  mapAppointmentRowToApi,
  parseAppointmentDate,
  type AppointmentWithRelations,
} from "@/lib/appointment-prisma-helpers"
import { withServiceDescriptionsFromDb } from "@/lib/service-queries"
import { normalizeAppointmentTime } from "@/lib/scheduling"
import { trySendWhatsAppAppointmentPostService } from "@/lib/whatsapp-appointment-events"
import { expireStaleAppointmentsForBarbershop } from "@/lib/appointment-expiry"
import { resolveEffectivePlanForActiveSession } from "@/lib/barbershop-effective-plan-server"
import { hasFeature } from "@/lib/plans"
import {
  expireStaleWaitlistNotifications,
  notifyNextWaitingForFreedSlot,
  primaryServiceIdFromAppointment,
} from "@/lib/waitlist-service"

function mergeServiceLineQuantities(rows: unknown): { order: string[]; qty: Map<string, number> } {
  const qty = new Map<string, number>()
  const order: string[] = []
  if (!Array.isArray(rows)) return { order, qty }
  for (const r of rows as { service_id?: string; quantity?: unknown }[]) {
    const sid = String(r?.service_id ?? "").trim()
    if (!sid) continue
    const q = Math.min(99, Math.max(1, Math.round(Number(r?.quantity ?? 1) || 1)))
    if (!qty.has(sid)) order.push(sid)
    qty.set(sid, (qty.get(sid) ?? 0) + q)
  }
  return { order, qty }
}

function aggregateServiceLinesFromRow(row: AppointmentWithRelations): {
  order: string[]
  qty: Map<string, number>
} {
  const lines = row.appointmentServiceLines
  if (lines?.length) {
    const qty = new Map<string, number>()
    const order: string[] = []
    for (const l of lines) {
      if (!qty.has(l.serviceId)) order.push(l.serviceId)
      qty.set(l.serviceId, (qty.get(l.serviceId) ?? 0) + l.quantity)
    }
    return { order, qty }
  }
  return { order: [row.serviceId], qty: new Map([[row.serviceId, 1]]) }
}

function sumRetailFromAppointmentRow(row: AppointmentWithRelations): number {
  let s = 0
  for (const l of row.appointmentRetailLines ?? []) {
    s += l.quantity * Number(l.unitPrice)
  }
  return Math.round(s * 100) / 100
}

async function computeServiceBundleBase(
  barbershopId: string,
  merged: { order: string[]; qty: Map<string, number> },
  previousIds: Set<string>
): Promise<{ base: number; unitByServiceId: Map<string, number> }> {
  if (merged.order.length === 0) {
    throw new Error("Informe pelo menos um serviço válido.")
  }
  const rows = await prisma.service.findMany({
    where: { id: { in: merged.order }, barbershopId },
    select: { id: true, price: true, active: true },
  })
  if (rows.length !== merged.order.length) {
    throw new Error("Serviço inválido ou de outra barbearia.")
  }
  const unitByServiceId = new Map<string, number>()
  let base = 0
  for (const sid of merged.order) {
    const r = rows.find((x) => x.id === sid)
    if (!r) throw new Error("Serviço inválido.")
    if (!r.active && !previousIds.has(sid)) {
      throw new Error("Serviço inativo no catálogo.")
    }
    const u = Number(r.price)
    unitByServiceId.set(sid, u)
    base += u * (merged.qty.get(sid) ?? 1)
  }
  return { base: Math.round(base * 100) / 100, unitByServiceId }
}

function mergeRetailLineQuantities(rows: unknown): Map<string, number> {
  const m = new Map<string, number>()
  if (!Array.isArray(rows)) return m
  for (const r of rows as { retail_product_id?: string; quantity?: unknown }[]) {
    const pid = String(r?.retail_product_id ?? "").trim()
    if (!pid) continue
    const q = Math.min(99, Math.max(1, Math.round(Number(r?.quantity ?? 1) || 1)))
    m.set(pid, (m.get(pid) ?? 0) + q)
  }
  return m
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    await expireStaleAppointmentsForBarbershop(barbershopId)
    const { id } = await params
    const body = await _request.json() as {
      status?: AppointmentStatus
      total_price?: number
      date?: string
      time?: string
      barber_id?: string
      service_id?: string
      /** Substitui as linhas de serviço do horário (painel agenda). Preferencial a `service_id` sozinho. */
      service_lines?: { service_id?: string; quantity?: number }[]
      retail_lines?: { retail_product_id?: string; quantity?: number }[]
    }
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)

    const before = await prisma.appointment.findFirst({
      where: {
        id,
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      },
      include: appointmentApiInclude,
    })
    if (!before) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
    }

    if (body.total_price !== undefined) {
      const p = Number(body.total_price)
      if (!Number.isFinite(p) || p < 0) {
        return NextResponse.json({ error: "Valor total inválido." }, { status: 400 })
      }
    }

    const beforeApi = mapAppointmentRowToApi(before)

    const previousServiceIds = new Set<string>(
      before.appointmentServiceLines?.length
        ? before.appointmentServiceLines.map((l) => l.serviceId)
        : [before.serviceId]
    )

    let mergedFromPayload: { order: string[]; qty: Map<string, number> } | null = null
    if (body.service_lines !== undefined) {
      mergedFromPayload = mergeServiceLineQuantities(body.service_lines)
      if (mergedFromPayload.order.length === 0) {
        return NextResponse.json(
          { error: "Informe pelo menos um serviço válido nas linhas de serviço." },
          { status: 400 }
        )
      }
    } else if (body.service_id !== undefined) {
      mergedFromPayload = {
        order: [body.service_id],
        qty: new Map([[body.service_id, 1]]),
      }
    }

    const touchSvc = mergedFromPayload !== null
    const touchRetail = body.retail_lines !== undefined

    const mergeForPricing = mergedFromPayload ?? aggregateServiceLinesFromRow(before)

    let pricedBundle: Awaited<ReturnType<typeof computeServiceBundleBase>>
    try {
      pricedBundle = await computeServiceBundleBase(barbershopId, mergeForPricing, previousServiceIds)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Serviços inválidos."
      return NextResponse.json(
        { error: msg },
        { status: err instanceof Error && msg.includes("não identificada") ? 401 : 400 }
      )
    }
    const nextDate = body.date ?? beforeApi.date
    const nextTime = body.time ?? beforeApi.time
    const nextBarberId = body.barber_id ?? beforeApi.barber_id

    if (
      body.date !== undefined ||
      body.time !== undefined ||
      body.barber_id !== undefined
    ) {
      const conflict = await hasBarberSlotConflict({
        barbershopId,
        barberId: nextBarberId,
        date: nextDate,
        time: nextTime,
        excludeAppointmentId: id,
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Este horário já está ocupado para o barbeiro escolhido." },
          { status: 409 }
        )
      }
    }

    let retailExtra = 0
    if (touchRetail) {
      const qtyByProduct = mergeRetailLineQuantities(body.retail_lines!)
      const pids = [...qtyByProduct.keys()]
      if (pids.length > 0) {
        const productRows = await prisma.retailProduct.findMany({
          where: { id: { in: pids }, barbershopId, active: true },
          select: { id: true, price: true },
        })
        if (productRows.length !== pids.length) {
          return NextResponse.json(
            { error: "Um ou mais produtos são inválidos ou estão inativos no catálogo." },
            { status: 400 }
          )
        }
        for (const pid of pids) {
          const row = productRows.find((p) => p.id === pid)
          if (!row) continue
          const q = qtyByProduct.get(pid) ?? 1
          retailExtra += q * Number(row.price)
        }
        retailExtra = Math.round(retailExtra * 100) / 100
      }
    }

    const serviceBaseForTotal = pricedBundle.base

    let resolvedSaleTotal: number
    if (touchRetail) {
      /* Total deve refletir o que será salvo nas linhas: serviços (catálogo) + produtos (catálogo).
       * O front pode enviar total_price antigo (ex.: usuário não recalculou após incluir pomada).
       * Não usar body.total_price aqui — produtos ficariam omitidos no total gravado no banco. */
      resolvedSaleTotal = Math.round((serviceBaseForTotal + retailExtra) * 100) / 100
    } else if (body.total_price !== undefined) {
      resolvedSaleTotal = Number(body.total_price)
    } else if (touchSvc) {
      resolvedSaleTotal = Math.round(
        (serviceBaseForTotal + sumRetailFromAppointmentRow(before)) * 100
      ) / 100
    } else {
      resolvedSaleTotal = Number(beforeApi.total_price) || 0
    }

    if (!Number.isFinite(resolvedSaleTotal) || resolvedSaleTotal < 0) {
      return NextResponse.json({ error: "Valor total inválido." }, { status: 400 })
    }

    let commissionPercent: number | undefined
    let commissionAmount: number | undefined
    if (body.status === "completed" && beforeApi.status !== "completed") {
      const barber = await prisma.barber.findFirst({
        where: { id: nextBarberId, barbershopId },
        select: { commission: true },
      })
      const pct = Number(barber?.commission) || 0
      commissionPercent = pct
      commissionAmount = saleCommissionAmount(resolvedSaleTotal, pct)
    }

    const patch: {
      status?: AppointmentStatus
      totalPrice?: number
      date?: Date
      time?: string
      barberId?: string
      serviceId?: string
      commissionPercent?: number
      commissionAmount?: number
    } = {}
    if (body.status !== undefined) patch.status = body.status

    const unitFilter = selectedUnitId ? { unitId: selectedUnitId } : {}

    const shouldPersistTotal = body.total_price !== undefined || touchRetail || touchSvc
    if (shouldPersistTotal) patch.totalPrice = resolvedSaleTotal

    if (body.date !== undefined) patch.date = parseAppointmentDate(body.date)
    if (body.time !== undefined) patch.time = normalizeAppointmentTime(body.time)
    if (body.barber_id !== undefined) patch.barberId = body.barber_id
    if (touchSvc) patch.serviceId = mergedFromPayload!.order[0]
    if (commissionPercent !== undefined) patch.commissionPercent = commissionPercent
    if (commissionAmount !== undefined) patch.commissionAmount = commissionAmount

    if (touchRetail || touchSvc) {
      const qtyByProduct = touchRetail ? mergeRetailLineQuantities(body.retail_lines!) : null
      const productRows =
        !touchRetail || !qtyByProduct || qtyByProduct.size === 0
          ? ([] as { id: string; price: unknown }[])
          : await prisma.retailProduct.findMany({
              where: {
                barbershopId,
                active: true,
                id: { in: [...qtyByProduct.keys()] },
              },
              select: { id: true, price: true },
            })
      if (touchRetail && qtyByProduct && qtyByProduct.size > 0 && productRows.length !== qtyByProduct.size) {
        return NextResponse.json({ error: "Produto inválido ou inativo no catálogo." }, { status: 400 })
      }

      const updatedCount = await prisma.$transaction(async (tx) => {
        if (touchSvc) {
          const m = mergedFromPayload!
          const unitBy = pricedBundle.unitByServiceId
          await tx.appointmentServiceLine.deleteMany({ where: { appointmentId: id } })
          for (const sid of m.order) {
            const qty = m.qty.get(sid)!
            const unitPrice = unitBy.get(sid) ?? 0
            await tx.appointmentServiceLine.create({
              data: {
                appointmentId: id,
                serviceId: sid,
                quantity: qty,
                unitPrice,
              },
            })
          }
        }
        if (touchRetail && qtyByProduct) {
          await tx.appointmentRetailLine.deleteMany({
            where: { appointmentId: id },
          })
          for (const pr of productRows) {
            const qty = qtyByProduct.get(pr.id)!
            await tx.appointmentRetailLine.create({
              data: {
                appointmentId: id,
                retailProductId: pr.id,
                quantity: qty,
                unitPrice: Number(pr.price),
              },
            })
          }
        }
        const u = await tx.appointment.updateMany({
          where: { id, barbershopId, ...unitFilter },
          data: patch,
        })
        return u.count
      })

      if (updatedCount === 0) {
        return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
      }
    } else {
      const { count } = await prisma.appointment.updateMany({
        where: { id, barbershopId, ...unitFilter },
        data: patch,
      })
      if (count === 0) {
        return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
      }
    }

    const updated = await prisma.appointment.findFirstOrThrow({
      where: { id, barbershopId },
      include: appointmentApiInclude,
    })
    const data = mapAppointmentRowToApi(updated) as Appointment
    const [enriched] = await withServiceDescriptionsFromDb([data])

    if (body.status === "canceled") {
      await notifyFirstWaitingList(barbershopId, enriched)
    }
    if (body.status === "completed" && beforeApi.status !== "completed") {
      void trySendWhatsAppAppointmentPostService(barbershopId, id)
    }
    return NextResponse.json(enriched as Appointment)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

async function notifyFirstWaitingList(barbershopId: string, appointment: Appointment) {
  const plan = await resolveEffectivePlanForActiveSession(barbershopId)
  if (!plan || !hasFeature(plan, "waiting_list")) return
  await expireStaleWaitlistNotifications(barbershopId)
  await notifyNextWaitingForFreedSlot(barbershopId, {
    barberId: appointment.barber_id,
    serviceId: primaryServiceIdFromAppointment(appointment),
    date: appointment.date,
    time: appointment.time,
    sourceAppointmentId: appointment.id,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const selectedUnitId = await resolveSelectedUnitId(barbershopId)
    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      },
      include: appointmentApiInclude,
    })
    if (appointment) {
      await notifyFirstWaitingList(barbershopId, mapAppointmentRowToApi(appointment))
    }
    const del = await prisma.appointment.deleteMany({
      where: {
        id,
        barbershopId,
        ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      },
    })
    if (del.count === 0) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
