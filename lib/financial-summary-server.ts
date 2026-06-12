import type { AppointmentStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { prismaAppointmentUnitFilter } from "@/lib/unit-context"
import { parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
import { COMMISSION_APPOINTMENT_STATUSES } from "@/lib/commissions"
import { loadFinancialLedgerEntries } from "@/lib/db/financial-ledger-store"
import { shopExpenseCategoryLabel } from "@/lib/shop-expenses"

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

export type FinancialSummaryPayload = {
  from: string
  to: string
  prev_from: string
  prev_to: string
  revenue: number
  revenue_previous: number
  revenue_today: number | null
  appointment_sale_count: number
  future_appointments_count: number
  future_appointments_revenue: number
  ticket_avg: number
  daily: { date: string; revenue: number }[]
  monthly_six: { key: string; mes: string; valor: number }[]
  by_service: {
    service_id: string
    nome: string
    revenue: number
    count: number
    cor: string
    percent: number
  }[]
  recent: {
    id: string
    tipo: "entrada" | "saida"
    titulo: string
    sub: string
    valor: number
    quando: string
  }[]
  /** true = soma de todas as unidades; false = só unidade ativa no cookie */
  network_scope: boolean
  unit_id: string | null
}

/** `unitId` omitido ou null = faturamento de todas as unidades somadas. */
export async function buildFinancialSummary(
  barbershopId: string,
  from: string,
  to: string,
  today: string | null,
  unitId?: string | null
): Promise<FinancialSummaryPayload> {
  const unitFilter = unitId ? prismaAppointmentUnitFilter(unitId) : {}

  const rangeWhere: Prisma.AppointmentWhereInput = {
    barbershopId,
    ...unitFilter,
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
  const dayCount = Math.floor((toD.getTime() - fromD.getTime()) / 86_400_000) + 1
  const prevTo = addDaysUTC(fromD, -1)
  const prevFrom = addDaysUTC(fromD, -dayCount)
  const prevFromStr = ymdUTC(prevFrom)
  const prevToStr = ymdUTC(prevTo)

  const prevSaleWhere: Prisma.AppointmentWhereInput = {
    barbershopId,
    ...unitFilter,
    status: { in: SALE_STATUSES },
    date: {
      gte: prevFrom,
      lte: prevTo,
    },
  }

  const sixMonthStart = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth() - 5, 1))
  const monthlyRangeWhere: Prisma.AppointmentWhereInput = {
    barbershopId,
    ...unitFilter,
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
      ...unitFilter,
      status: { in: SALE_STATUSES },
      date: t,
    }
  }

  const futureFromYmd = today && today > from ? today : from
  const futureWhere: Prisma.AppointmentWhereInput = {
    barbershopId,
    ...unitFilter,
    status: { in: ["pending", "confirmed"] },
    date: {
      gte: parseAppointmentDate(futureFromYmd),
      lte: parseAppointmentDate(to),
    },
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
    futureAgg,
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
        unit: { select: { name: true } },
      },
    }),
    loadFinancialLedgerEntries({
      barbershopId,
      occurredGte: new Date(`${from}T00:00:00.000Z`),
      occurredLte: new Date(`${to}T23:59:59.999Z`),
      limit: 25,
    }),
    todayWhere
      ? prisma.appointment.aggregate({
          where: todayWhere,
          _sum: { totalPrice: true },
        })
      : Promise.resolve(null),
    prisma.appointment.aggregate({
      where: futureWhere,
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
  ])

  const revenue = Number(periodAgg._sum.totalPrice ?? 0)
  const appointmentSaleCount = periodAgg._count._all
  const ticketAvg =
    appointmentSaleCount > 0 ? Math.round((revenue / appointmentSaleCount) * 100) / 100 : 0

  const revenuePrevious = Number(prevAgg._sum.totalPrice ?? 0)
  const revenueToday = todayAgg ? Number(todayAgg._sum.totalPrice ?? 0) : null
  const futureAppointmentsCount = futureAgg._count._all
  const futureAppointmentsRevenue = Math.round(Number(futureAgg._sum.totalPrice ?? 0) * 100) / 100

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
    const unitLabel = a.unit?.name ? ` · ${a.unit.name}` : ""
    return {
      id: `appt-${a.id}`,
      tipo: "entrada" as const,
      titulo: a.client?.name ?? "Cliente",
      sub: `${a.service?.name ?? "Serviço"} · ${a.barber?.name ?? ""}${unitLabel} · ${a.status}${isSale ? "" : " (não faturado)"} · ${ymdUTC(a.date)} ${a.time.slice(0, 5)}`,
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
      titulo: e.note?.trim() || shopExpenseCategoryLabel(e.category),
      sub: shopExpenseCategoryLabel(e.category),
      valor: Math.round(amt * 100) / 100,
      quando: e.occurredAt.toISOString().slice(0, 16).replace("T", " "),
    }
  })

  const recent = [...recentFromAppointments, ...recentFromLedger]
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 15)

  return {
    from,
    to,
    prev_from: prevFromStr,
    prev_to: prevToStr,
    revenue: Math.round(revenue * 100) / 100,
    revenue_previous: Math.round(revenuePrevious * 100) / 100,
    revenue_today: revenueToday != null ? Math.round(revenueToday * 100) / 100 : null,
    appointment_sale_count: appointmentSaleCount,
    future_appointments_count: futureAppointmentsCount,
    future_appointments_revenue: futureAppointmentsRevenue,
    ticket_avg: ticketAvg,
    daily,
    monthly_six,
    by_service: by_service_share,
    recent,
    network_scope: !unitId,
    unit_id: unitId ?? null,
  }
}
