import type { Prisma } from "@prisma/client"
import {
  aggregateCommissionsForRange,
  COMMISSION_APPOINTMENT_STATUSES,
} from "@/lib/commissions"
import { parseAppointmentDate } from "@/lib/appointment-prisma-helpers"
import { isLedgerOutDirection, shopExpenseCategoryLabel, type ShopExpenseRow, ledgerEntryToExpense } from "@/lib/shop-expenses"
import { prisma } from "@/lib/prisma"
import { prismaAppointmentUnitFilter } from "@/lib/unit-context"
import type { AppointmentStatus } from "@prisma/client"

function prismaLedgerUnitFilter(unitId: string | null): Prisma.FinancialLedgerEntryWhereInput {
  if (!unitId) return {}
  return { unitId }
}

export type FinancialPnlPayload = {
  from: string
  to: string
  revenue: number
  expenses_total: number
  commissions_total: number
  owner_profit: number
  commission_enabled: boolean
  expenses_by_category: { category: string; label: string; amount: number }[]
  expenses: ShopExpenseRow[]
  network_scope: boolean
  unit_id: string | null
}

export async function buildFinancialPnl(
  barbershopId: string,
  from: string,
  to: string,
  unitId: string | null,
  commissionEnabled: boolean
): Promise<FinancialPnlPayload> {
  const unitFilter = unitId ? prismaAppointmentUnitFilter(unitId) : {}
  const ledgerUnitFilter = prismaLedgerUnitFilter(unitId)

  const fromDate = parseAppointmentDate(from)
  const toDate = parseAppointmentDate(to)
  const occurredGte = new Date(`${from}T00:00:00.000Z`)
  const occurredLte = new Date(`${to}T23:59:59.999Z`)

  const [revenueAgg, expenseRows, commissions] = await Promise.all([
    prisma.appointment.aggregate({
      where: {
        barbershopId,
        ...unitFilter,
        date: { gte: fromDate, lte: toDate },
        status: { in: [...COMMISSION_APPOINTMENT_STATUSES] as AppointmentStatus[] },
      },
      _sum: { totalPrice: true },
    }),
    prisma.financialLedgerEntry.findMany({
      where: {
        barbershopId,
        ...ledgerUnitFilter,
        occurredAt: { gte: occurredGte, lte: occurredLte },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { unit: { select: { name: true } } },
    }),
    commissionEnabled
      ? aggregateCommissionsForRange(barbershopId, from, to, unitId)
      : Promise.resolve({ total: 0, byBarber: [] }),
  ])

  const revenue = Math.round(Number(revenueAgg._sum.totalPrice ?? 0) * 100) / 100

  const outExpenses = expenseRows.filter((e) => isLedgerOutDirection(e.direction))
  let expensesTotal = 0
  const byCategory = new Map<string, number>()
  const expenses: ShopExpenseRow[] = []

  for (const row of outExpenses) {
    const amt = Math.abs(Number(row.amount))
    expensesTotal += amt
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + amt)
    expenses.push(ledgerEntryToExpense(row))
  }
  expensesTotal = Math.round(expensesTotal * 100) / 100

  const expenses_by_category = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      label: shopExpenseCategoryLabel(category),
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount)

  const commissionsTotal = Math.round(commissions.total * 100) / 100
  const ownerProfit = Math.round((revenue - expensesTotal - commissionsTotal) * 100) / 100

  return {
    from,
    to,
    revenue,
    expenses_total: expensesTotal,
    commissions_total: commissionsTotal,
    owner_profit: ownerProfit,
    commission_enabled: commissionEnabled,
    expenses_by_category,
    expenses,
    network_scope: !unitId,
    unit_id: unitId,
  }
}
