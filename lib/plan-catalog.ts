import type { SubscriptionPlan } from "@/lib/db/types"
import {
  BARBER_LIMITS,
  PLAN_FEATURES,
  PLAN_LABELS,
  PLAN_PRICES,
  TRIAL_DAYS,
  TRIAL_PLAN,
  normalizeTrialDays,
} from "@/lib/plans"
import { getPlatformSettings } from "@/lib/platform-settings"
import { mergePlanPricesFromDb } from "@/lib/plan-prices"

export type PlanCatalogEntry = {
  name: string
  price: number
  barberLimit: number | null
  features: string[]
}

export type PlanCatalog = {
  trialDays: number
  trialPlan: SubscriptionPlan
  plans: Record<SubscriptionPlan, PlanCatalogEntry>
}

type StoredPlanConfig = Partial<{
  name: string
  price: number
  barberLimit: number | null
  features: string[]
}>

type StoredPlanConfigs = Partial<{
  trialDays: number
  trialPlan: SubscriptionPlan
  plans: Partial<Record<SubscriptionPlan, StoredPlanConfig>>
}>

const PLANS: SubscriptionPlan[] = ["basic", "pro", "premium"]

function defaultCatalog(): PlanCatalog {
  return {
    trialDays: TRIAL_DAYS,
    trialPlan: TRIAL_PLAN,
    plans: {
      basic: {
        name: PLAN_LABELS.basic,
        price: PLAN_PRICES.basic,
        barberLimit: BARBER_LIMITS.basic,
        features: [...PLAN_FEATURES.basic],
      },
      pro: {
        name: PLAN_LABELS.pro,
        price: PLAN_PRICES.pro,
        barberLimit: BARBER_LIMITS.pro,
        features: [...PLAN_FEATURES.pro],
      },
      premium: {
        name: PLAN_LABELS.premium,
        price: PLAN_PRICES.premium,
        barberLimit: BARBER_LIMITS.premium,
        features: [...PLAN_FEATURES.premium],
      },
    },
  }
}

function parseStoredConfigs(raw: unknown): StoredPlanConfigs | null {
  if (!raw || typeof raw !== "object") return null
  return raw as StoredPlanConfigs
}

export async function getPlanCatalog(): Promise<PlanCatalog> {
  const base = defaultCatalog()
  try {
    const row = await getPlatformSettings()
    const prices = mergePlanPricesFromDb({
      priceBasic: row.priceBasic,
      pricePro: row.pricePro,
      pricePremium: row.pricePremium,
    })
    for (const p of PLANS) {
      base.plans[p].price = prices[p]
    }
    if (row.defaultTrialDays > 0) base.trialDays = normalizeTrialDays(row.defaultTrialDays)
    if (row.defaultTrialPlan) base.trialPlan = row.defaultTrialPlan

    const stored = parseStoredConfigs(row.planConfigs)
    if (stored?.trialDays && stored.trialDays > 0) {
      base.trialDays = normalizeTrialDays(stored.trialDays)
    }
    if (stored?.trialPlan && PLANS.includes(stored.trialPlan)) base.trialPlan = stored.trialPlan

    for (const p of PLANS) {
      const s = stored?.plans?.[p]
      if (!s) continue
      if (s.name?.trim()) base.plans[p].name = s.name.trim()
      if (typeof s.price === "number" && s.price > 0) base.plans[p].price = s.price
      if (s.barberLimit === null || (typeof s.barberLimit === "number" && s.barberLimit >= 0)) {
        base.plans[p].barberLimit = s.barberLimit
      }
      if (Array.isArray(s.features) && s.features.length > 0) {
        base.plans[p].features = s.features.map(String)
      }
    }
  } catch (e) {
    console.error("[plan-catalog] getPlanCatalog", e)
  }
  base.trialDays = normalizeTrialDays(base.trialDays)
  if (!PLANS.includes(base.trialPlan)) base.trialPlan = TRIAL_PLAN
  return base
}

export function mergePlanCatalogIntoStored(
  current: unknown,
  patch: {
    trialDays?: number
    trialPlan?: SubscriptionPlan
    plans?: Partial<Record<SubscriptionPlan, StoredPlanConfig>>
  }
): StoredPlanConfigs {
  const prev = parseStoredConfigs(current) ?? {}
  return {
    trialDays: patch.trialDays ?? prev.trialDays,
    trialPlan: patch.trialPlan ?? prev.trialPlan,
    plans: { ...prev.plans, ...patch.plans },
  }
}

export async function getTrialConfig(): Promise<{ days: number; plan: SubscriptionPlan }> {
  const catalog = await getPlanCatalog()
  return { days: catalog.trialDays, plan: catalog.trialPlan }
}

export async function getPlanPrice(plan: SubscriptionPlan): Promise<number> {
  const catalog = await getPlanCatalog()
  return catalog.plans[plan].price
}

export async function getPublicTrialDays(): Promise<number> {
  const catalog = await getPlanCatalog()
  return catalog.trialDays
}
