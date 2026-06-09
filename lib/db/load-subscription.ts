import { prisma } from "@/lib/prisma"
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types"

export type LoadedSubscription = {
  id: string
  barbershopId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  trialEnd: Date | null
  nextPayment: Date | null
  asaasCustomerId: string | null
  asaasSubscriptionId: string | null
  billingType: string | null
  cardSetupAt: Date | null
  postTrialChoice: string | null
  graceAccessUntil: Date | null
  createdAt: Date
  updatedAt: Date
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === "string" && v) return v
  }
  return null
}

function pickDate(row: Record<string, unknown>, ...keys: string[]): Date | null {
  for (const k of keys) {
    const v = row[k]
    if (v instanceof Date) return v
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return null
}

function mapRow(row: Record<string, unknown>): LoadedSubscription {
  const createdAt = pickDate(row, "created_at", "createdAt") ?? new Date()
  return {
    id: pickStr(row, "id") ?? "",
    barbershopId: pickStr(row, "barbershop_id", "barbershopId") ?? "",
    plan: (pickStr(row, "plan") ?? "pro") as SubscriptionPlan,
    status: (pickStr(row, "status") ?? "trial") as SubscriptionStatus,
    trialEnd: pickDate(row, "trial_end", "trialEnd"),
    nextPayment: pickDate(row, "next_payment", "nextPayment"),
    asaasCustomerId: pickStr(row, "asaas_customer_id", "asaasCustomerId"),
    asaasSubscriptionId: pickStr(row, "asaas_subscription_id", "asaasSubscriptionId"),
    billingType: pickStr(row, "billing_type", "billingType"),
    cardSetupAt: pickDate(row, "card_setup_at", "cardSetupAt"),
    postTrialChoice: pickStr(row, "post_trial_choice", "postTrialChoice"),
    graceAccessUntil: pickDate(row, "grace_access_until", "graceAccessUntil"),
    createdAt,
    updatedAt: pickDate(row, "updated_at", "updatedAt") ?? createdAt,
  }
}

function isSchemaMismatchError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /column.*does not exist|not available|P2022/i.test(msg)
}

const RAW_QUERIES = [
  `SELECT * FROM "Subscription" WHERE barbershop_id = $1::uuid LIMIT 1`,
  `SELECT * FROM "Subscription" WHERE "barbershopId" = $1::uuid LIMIT 1`,
  `SELECT * FROM subscriptions WHERE barbershop_id = $1::uuid LIMIT 1`,
] as const

/** Lê assinatura mesmo quando nomes de colunas/tabela divergem do Prisma (produção legada). */
export async function loadSubscriptionByBarbershopId(
  barbershopId: string
): Promise<LoadedSubscription | null> {
  try {
    const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
    if (!sub) return null
    return {
      ...sub,
      plan: sub.plan as SubscriptionPlan,
      status: sub.status as SubscriptionStatus,
    }
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e
  }

  for (const sql of RAW_QUERIES) {
    try {
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, barbershopId)
      const row = rows[0]
      if (row) return mapRow(row)
    } catch {
      /* tenta próxima variante */
    }
  }

  return null
}

export type BarbershopBillingInfo = {
  role: string
  isTest: boolean
  name: string
  email: string
}

const BARBERSHOP_RAW_QUERIES = [
  `SELECT role, name, email, COALESCE(is_test, false) AS "isTest" FROM "Barbershop" WHERE id = $1::uuid LIMIT 1`,
  `SELECT role, name, email, COALESCE("isTest", false) AS "isTest" FROM "Barbershop" WHERE id = $1::uuid LIMIT 1`,
  `SELECT role, name, email, COALESCE(is_test, false) AS "isTest" FROM barbershops WHERE id = $1::uuid LIMIT 1`,
] as const

export async function loadBarbershopBillingInfo(
  barbershopId: string
): Promise<BarbershopBillingInfo | null> {
  try {
    return await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { role: true, isTest: true, name: true, email: true },
    })
  } catch (e) {
    if (!isSchemaMismatchError(e)) throw e
  }

  for (const sql of BARBERSHOP_RAW_QUERIES) {
    try {
      const rows = await prisma.$queryRawUnsafe<BarbershopBillingInfo[]>(sql, barbershopId)
      if (rows[0]) return rows[0]
    } catch {
      /* tenta próxima variante */
    }
  }

  return null
}
