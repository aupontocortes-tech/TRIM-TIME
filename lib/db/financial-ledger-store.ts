import { prisma } from "@/lib/prisma"

export type LedgerExpenseRow = {
  id: string
  barbershopId: string
  direction: string
  category: string
  amount: unknown
  note: string | null
  vendor: string | null
  occurredAt: Date
  unitId: string | null
  unit?: { name: string } | null
}

function isMissingColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /column.*does not exist|not available/i.test(msg)
}

export async function loadFinancialLedgerEntries(params: {
  barbershopId: string
  occurredGte: Date
  occurredLte: Date
  unitId?: string | null
  limit?: number
}): Promise<LedgerExpenseRow[]> {
  const { barbershopId, occurredGte, occurredLte, unitId, limit } = params
  try {
    const rows = await prisma.financialLedgerEntry.findMany({
      where: {
        barbershopId,
        ...(unitId ? { unitId } : {}),
        occurredAt: { gte: occurredGte, lte: occurredLte },
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { unit: { select: { name: true } } },
    })
    const mapped = rows.map((r) => ({
      id: r.id,
      barbershopId: r.barbershopId,
      direction: r.direction,
      category: r.category,
      amount: r.amount,
      note: r.note,
      vendor: r.vendor,
      occurredAt: r.occurredAt,
      unitId: r.unitId,
      unit: r.unit,
    }))
    return limit ? mapped.slice(0, limit) : mapped
  } catch (e) {
    if (!isMissingColumnError(e)) throw e
  }

  type RawRow = {
    id: string
    barbershop_id: string
    direction: string
    category: string
    amount: unknown
    note: string | null
    occurred_at: Date
  }

  const rows = limit
    ? await prisma.$queryRaw<RawRow[]>`
        SELECT id, barbershop_id, direction, category, amount, note, occurred_at
        FROM financial_ledger_entries
        WHERE barbershop_id = ${barbershopId}::uuid
          AND occurred_at >= ${occurredGte}
          AND occurred_at <= ${occurredLte}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<RawRow[]>`
        SELECT id, barbershop_id, direction, category, amount, note, occurred_at
        FROM financial_ledger_entries
        WHERE barbershop_id = ${barbershopId}::uuid
          AND occurred_at >= ${occurredGte}
          AND occurred_at <= ${occurredLte}
        ORDER BY occurred_at DESC
      `

  return rows.map((r) => ({
    id: r.id,
    barbershopId: r.barbershop_id,
    direction: r.direction,
    category: r.category,
    amount: r.amount,
    note: r.note,
    vendor: null,
    occurredAt: r.occurred_at,
    unitId: null,
    unit: null,
  }))
}

export async function createFinancialLedgerExpense(params: {
  barbershopId: string
  category: string
  amount: number
  note: string
  vendor?: string | null
  occurredAt: Date
  unitId?: string | null
}): Promise<LedgerExpenseRow> {
  const { barbershopId, category, amount, note, vendor, occurredAt, unitId } = params
  try {
    const created = await prisma.financialLedgerEntry.create({
      data: {
        barbershopId,
        unitId: unitId ?? null,
        direction: "out",
        category,
        amount,
        note,
        vendor: vendor ?? null,
        occurredAt,
      },
      include: { unit: { select: { name: true } } },
    })
    return {
      id: created.id,
      barbershopId: created.barbershopId,
      direction: created.direction,
      category: created.category,
      amount: created.amount,
      note: created.note,
      vendor: created.vendor,
      occurredAt: created.occurredAt,
      unitId: created.unitId,
      unit: created.unit,
    }
  } catch (e) {
    if (!isMissingColumnError(e)) throw e
  }

  type RawRow = {
    id: string
    barbershop_id: string
    direction: string
    category: string
    amount: unknown
    note: string | null
    occurred_at: Date
  }

  const inserted = await prisma.$queryRaw<RawRow[]>`
    INSERT INTO financial_ledger_entries (barbershop_id, direction, category, amount, note, occurred_at)
    VALUES (${barbershopId}::uuid, 'out', ${category}, ${amount}, ${note}, ${occurredAt})
    RETURNING id, barbershop_id, direction, category, amount, note, occurred_at
  `

  const row = inserted[0]
  if (!row) throw new Error("Não foi possível registrar a despesa.")

  return {
    id: row.id,
    barbershopId: row.barbershop_id,
    direction: row.direction,
    category: row.category,
    amount: row.amount,
    note: row.note,
    vendor: vendor ?? null,
    occurredAt: row.occurred_at,
    unitId: null,
    unit: null,
  }
}

export async function deleteFinancialLedgerExpense(
  id: string,
  barbershopId: string
): Promise<boolean> {
  try {
    const row = await prisma.financialLedgerEntry.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    })
    if (!row) return false
    await prisma.financialLedgerEntry.delete({ where: { id } })
    return true
  } catch (e) {
    if (!isMissingColumnError(e)) throw e
  }

  const deleted = await prisma.$executeRaw`
    DELETE FROM financial_ledger_entries
    WHERE id = ${id}::uuid AND barbershop_id = ${barbershopId}::uuid
  `
  return Number(deleted) > 0
}

export async function updateFinancialLedgerExpense(
  id: string,
  barbershopId: string,
  data: { category?: string; amount?: number; note?: string | null; vendor?: string | null; occurredAt?: Date }
): Promise<LedgerExpenseRow | null> {
  try {
    const existing = await prisma.financialLedgerEntry.findFirst({ where: { id, barbershopId } })
    if (!existing) return null
    const updated = await prisma.financialLedgerEntry.update({
      where: { id },
      data,
      include: { unit: { select: { name: true } } },
    })
    return {
      id: updated.id,
      barbershopId: updated.barbershopId,
      direction: updated.direction,
      category: updated.category,
      amount: updated.amount,
      note: updated.note,
      vendor: updated.vendor,
      occurredAt: updated.occurredAt,
      unitId: updated.unitId,
      unit: updated.unit,
    }
  } catch (e) {
    if (!isMissingColumnError(e)) throw e
  }

  const note = data.note
  if (data.category !== undefined) {
    await prisma.$executeRaw`UPDATE financial_ledger_entries SET category = ${data.category} WHERE id = ${id}::uuid AND barbershop_id = ${barbershopId}::uuid`
  }
  if (data.amount !== undefined) {
    await prisma.$executeRaw`UPDATE financial_ledger_entries SET amount = ${data.amount} WHERE id = ${id}::uuid AND barbershop_id = ${barbershopId}::uuid`
  }
  if (note !== undefined) {
    await prisma.$executeRaw`UPDATE financial_ledger_entries SET note = ${note} WHERE id = ${id}::uuid AND barbershop_id = ${barbershopId}::uuid`
  }
  if (data.occurredAt !== undefined) {
    await prisma.$executeRaw`UPDATE financial_ledger_entries SET occurred_at = ${data.occurredAt} WHERE id = ${id}::uuid AND barbershop_id = ${barbershopId}::uuid`
  }

  type RawRow = {
    id: string
    barbershop_id: string
    direction: string
    category: string
    amount: unknown
    note: string | null
    occurred_at: Date
  }

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT id, barbershop_id, direction, category, amount, note, occurred_at
    FROM financial_ledger_entries
    WHERE id = ${id}::uuid AND barbershop_id = ${barbershopId}::uuid
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    barbershopId: row.barbershop_id,
    direction: row.direction,
    category: row.category,
    amount: row.amount,
    note: row.note,
    vendor: data.vendor ?? null,
    occurredAt: row.occurred_at,
    unitId: null,
    unit: null,
  }
}