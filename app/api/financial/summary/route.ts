import { NextResponse } from "next/server"
import type { AppointmentStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireBarbershopId } from "@/lib/tenant"
import { prismaAppointmentUnitFilter, resolveSelectedUnitId } from "@/lib/unit-context"
import { parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
import { COMMISSION_APPOINTMENT_STATUSES } from "@/lib/commissions"

const SALE_STATUSES: AppointmentStatus[] = [...COMMISSION_APPOINTMENT_STATUSES]

function ymdUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDaysUTC(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + delta))
}

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const { searchParams } = new URL(request.url)
    let from = searchParams.get("from")
    let to = searchParams.get("to")
    const today = searchParams.get("today")

    if (!from || !to) {
      return NextResponse.json(
        { error: "Informe from e to (YYYY-MM-DD)." },
        { status: 400 }
      )
    }
    if (from > to) {
      const s = from
      from = to
      to = s
    }

    const selectedUnitId = await resolveSelectedUnitId(barbershopId)

    const rangeWhere: Prisma.AppointmentWhereInput = {
      barbershopId,
      ...prismaAppointmentUnitFilter(selectedUnitId),
      date: {
        gte: parseAppointmentDate(from),
        lte: parseAppointmentDate(to),
      },
    }

    const saleWhere: Prisma.AppointmentWhereInput = {
      ...rangeWhere,
      status: { in: SALE_STATUSES },
    }

    const fromD = parseAppointmentDate(from)
    const toD = parseAppointmentDate(to)
    const dayCount =
      Math.floor((toD.getTime() - fromD.getTime()) / 86_400_000) + 1
    const prevTo = addDaysUTC(fromD, -1)
    const prevFrom = addDaysUTC(fromD, -dayCount)
    const prevFromStr = ymdUTC(prevFrom)
    const prevToStr = ymdUTC(prevTo)

    const prevSaleWhere: Prisma.AppointmentWhereInput = {
      barbershopId,
      ...prismaAppointmentUnitFilter(selectedUnitId),
      status: { in: SALE_STATUSES },
      date: {
        gte: prevFrom,
        lte: prevTo,
      },
    }

    const sixMonthStart = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth() - 5, 1))
    const monthlyRangeWhere: Prisma.AppointmentWhereInput = {
      barbershopId,
      ...prismaAppointmentUnitFilter(selectedUnitId),
      status: { in: SALE_STATUSES },
      date: {
        gte: sixMonthStart,
        lte: toD,
      },
    }

    let todayWhere: Prisma.AppointmentWhereInput | null = null
    if (today) {
      const t = parseAppointmentDate(today)
      todayWhere = {
        barbershopId,
        ...prismaAppointmentUnitFilter(selectedUnitId),
        status: { in: SALE_STATUSES },
        date: t,
      }
    }

    const [
      periodAgg,
      prevAgg,
      dailyGroups,
      monthlyDayGroups,
      serviceGroups,
      recentAppointments,
      ledgerRows,
      todayAgg,
    ] = await Promise.all([
      prisma.appointment.aggregate({
        where: saleWhere,
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
      prisma.appointment.aggregate({
        where: prevSaleWhere,
        _sum: { totalPrice: true },
      }),
      prisma.appointment.groupBy({
        by: ["date"],
        where: saleWhere,
        _sum: { totalPrice: true },
      }),
      prisma.appointment.groupBy({
        by: ["date"],
        where: monthlyRangeWhere,
        _sum: { totalPrice: true },
      }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: saleWhere,
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
      prisma.appointment.findMany({
        where: rangeWhere,
        orderBy: [{ date: "desc" }, { time: "desc" }],
        take: 25,
        include: {
          client: { select: { name: true } },
          service: { select: { name: true } },
          barber: { select: { name: true } },
        },
      }),
      prisma.financialLedgerEntry.findMany({
        where: {
          barbershopId,
          occurredAt: {
            gte: new Date(`${from}T00:00:00.000Z`),
            lte: new Date(`${to}T23:59:59.999Z`),
          },
        },
        orderBy: { occurredAt: "desc" },
        take: 25,
      }),
      todayWhere
        ? prisma.appointment.aggregate({
            where: todayWhere,
            _sum: { totalPrice: true },
          })
        : Promise.resolve(null),
    ])

    const revenue = Number(periodAgg._sum.totalPrice ?? 0)
    const appointmentSaleCount = periodAgg._count._all
    const ticketAvg =
      appointmentSaleCount > 0 ? Math.round((revenue / appointmentSaleCount) * 100) / 100 : 0

    const revenuePrevious = Number(prevAgg._sum.totalPrice ?? 0)
    const revenueToday = todayAgg ? Number(todayAgg._sum.totalPrice ?? 0) : null

    const daily = dailyGroups
      .map((g) => ({
        date: ymdUTC(g.date),
        revenue: Number(g._sum.totalPrice ?? 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const monthTotals = new Map<string, number>()
    for (const g of monthlyDayGroups) {
      const key = `${g.date.getUTCFullYear()}-${String(g.date.getUTCMonth() + 1).padStart(2, "0")}`
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + Number(g._sum.totalPrice ?? 0))
    }
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    const monthly_six: { key: string; mes: string; valor: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth() - i, 1))
      const key = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`
      monthly_six.push({
        key,
        mes: mesesNomes[ref.getUTCMonth()],
        valor: Math.round((monthTotals.get(key) ?? 0) * 100) / 100,
      })
    }

    const serviceIds = serviceGroups.map((g) => g.serviceId)
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, barbershopId },
      select: { id: true, name: true },
    })
    const nameByService = new Map(services.map((s) => [s.id, s.name]))

    const palette = ["#d4a853", "#8b7355", "#c9b896", "#5c5c5c", "#a67c52", "#6b7280"]
    const by_service = serviceGroups
      .map((g, i) => ({
        service_id: g.serviceId,
        nome: nameByService.get(g.serviceId) ?? "Serviço",
        revenue: Math.round(Number(g._sum.totalPrice ?? 0) * 100) / 100,
        count: g._count._all,
        cor: palette[i % palette.length],
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const pieTotal = by_service.reduce((acc, s) => acc + s.revenue, 0) || 1
    const by_service_share = by_service.map((s) => ({
      ...s,
      percent: Math.round((s.revenue / pieTotal) * 1000) / 10,
    }))

    type RecentRow = {
      id: string
      tipo: "entrada" | "saida"
      titulo: string
      sub: string
      valor: number
      quando: string
    }

    const recentFromAppointments: RecentRow[] = recentAppointments.map((a) => {
      const price = a.totalPrice != null ? Number(a.totalPrice) : 0
      const isSale = SALE_STATUSES.includes(a.status)
      return {
        id: `appt-${a.id}`,
        tipo: "entrada" as const,
        titulo: a.client?.name ?? "Cliente",
        sub: `${a.service?.name ?? "Serviço"} · ${a.barber?.name ?? ""} · ${a.status}${isSale ? "" : " (não faturado)"} · ${ymdUTC(a.date)} ${a.time.slice(0, 5)}`,
        valor: Math.round(price * 100) / 100,
        quando: `${ymdUTC(a.date)} ${a.time.slice(0, 5)}`,
      }
    })

    const recentFromLedger: RecentRow[] = ledgerRows.map((e) => {
      const dir = e.direction.toLowerCase()
      const out = dir === "out" || dir === "saida" || Number(e.amount) < 0
      const amt = Math.abs(Number(e.amount))
      return {
        id: `ledger-${e.id}`,
        tipo: out ? "saida" : "entrada",
        titulo: e.note || e.category || "Lançamento",
        sub: e.category,
        valor: Math.round(amt * 100) / 100,
        quando: e.occurredAt.toISOString().slice(0, 16).replace("T", " "),
      }
    })

    const recent = [...recentFromAppointments, ...recentFromLedger]
      .sort((a, b) => b.quando.localeCompare(a.quando))
      .slice(0, 15)

    return NextResponse.json({
      from,
      to,
      prev_from: prevFromStr,
      prev_to: prevToStr,
      revenue: Math.round(revenue * 100) / 100,
      revenue_previous: Math.round(revenuePrevious * 100) / 100,
      revenue_today: revenueToday != null ? Math.round(revenueToday * 100) / 100 : null,
      appointment_sale_count: appointmentSaleCount,
      ticket_avg: ticketAvg,
      daily,
      monthly_six,
      by_service: by_service_share,
      recent,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar resumo financeiro" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
