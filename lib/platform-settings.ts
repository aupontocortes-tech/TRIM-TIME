import type { SubscriptionPlan } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import {
  defaultPlanPrices,
  isPaymentApiEnabledFromEnv,
  mergePlanPricesFromDb,
  type PlanPricesMap,
} from "@/lib/plan-prices"
import { TRIAL_DAYS } from "@/lib/plans"
import {
  buildLandingWhatsappUrl,
  normalizeWhatsappPhoneDigits,
  whatsappDigitsForWaMe,
} from "@/lib/whatsapp-phone"

export { buildLandingWhatsappUrl, normalizeWhatsappPhoneDigits, whatsappDigitsForWaMe }

const SINGLETON_ID = "singleton"

type PlatformSettingsRow = NonNullable<
  Awaited<ReturnType<typeof prisma.platformSettings.findUnique>>
>

/** Corrige default_trial_days / plan_configs.trialDays legados (ex.: 2 dias da migration 020). */
async function healStaleTrialDaysIfNeeded(row: PlatformSettingsRow): Promise<PlatformSettingsRow> {
  const needsDefault = row.defaultTrialDays < TRIAL_DAYS
  let planConfigs = row.planConfigs
  let needsPlanConfigs = false
  if (planConfigs && typeof planConfigs === "object") {
    const pc = planConfigs as { trialDays?: number }
    if (typeof pc.trialDays === "number" && pc.trialDays > 0 && pc.trialDays < TRIAL_DAYS) {
      needsPlanConfigs = true
      planConfigs = { ...pc, trialDays: TRIAL_DAYS }
    }
  }
  if (!needsDefault && !needsPlanConfigs) return row
  return prisma.platformSettings.update({
    where: { id: row.id },
    data: {
      ...(needsDefault ? { defaultTrialDays: TRIAL_DAYS } : {}),
      ...(needsPlanConfigs ? { planConfigs: planConfigs as object } : {}),
    },
  })
}

export async function getPlatformSettings(): Promise<PlatformSettingsRow> {
  const existing = await prisma.platformSettings.findUnique({
    where: { id: SINGLETON_ID },
  })
  let row: PlatformSettingsRow =
    existing ??
    (await prisma.platformSettings.create({
      data: { id: SINGLETON_ID, defaultTrialDays: TRIAL_DAYS, defaultTrialPlan: "pro" },
    }))

  if (row.defaultTrialDays < TRIAL_DAYS) {
    return healStaleTrialDaysIfNeeded(row)
  }

  const pc =
    row.planConfigs && typeof row.planConfigs === "object"
      ? (row.planConfigs as { trialDays?: number })
      : null
  if (typeof pc?.trialDays === "number" && pc.trialDays > 0 && pc.trialDays < TRIAL_DAYS) {
    return healStaleTrialDaysIfNeeded(row)
  }

  return row
}

export function landingWhatsappPhoneFromEnv(): string | null {
  const p = process.env.LANDING_WHATSAPP_PHONE?.trim()
  return p || null
}

export async function getLandingWhatsappPhone(): Promise<string | null> {
  try {
    const row = await getPlatformSettings()
    const fromDb = row.landingWhatsappPhone?.trim()
    if (fromDb) return fromDb
  } catch (e) {
    console.error("[platform-settings] getLandingWhatsappPhone", e)
  }
  return landingWhatsappPhoneFromEnv()
}

export async function resolveLandingWhatsappUrl(): Promise<string | null> {
  const phone = await getLandingWhatsappPhone()
  if (!phone) return null
  const url = buildLandingWhatsappUrl(phone)
  return url || null
}

export async function getEffectivePlanPrices(): Promise<PlanPricesMap> {
  try {
    const row = await getPlatformSettings()
    return mergePlanPricesFromDb({
      priceBasic: row.priceBasic,
      pricePro: row.pricePro,
      pricePremium: row.pricePremium,
    })
  } catch (e) {
    console.error("[platform-settings] getEffectivePlanPrices", e)
    return defaultPlanPrices()
  }
}

export async function isPaymentApiActive(): Promise<boolean> {
  try {
    const row = await getPlatformSettings()
    if (row.paymentApiEnabled) return true
  } catch {
    /* fallback env */
  }
  return isPaymentApiEnabledFromEnv()
}

export function platformSettingsToApi(row: {
  landingWhatsappPhone: string | null
  priceBasic: unknown
  pricePro: unknown
  pricePremium: unknown
  planConfigs?: unknown
  defaultTrialDays: number
  defaultTrialPlan: SubscriptionPlan
  paymentApiEnabled: boolean
}) {
  const plan_prices = mergePlanPricesFromDb({
    priceBasic: row.priceBasic,
    pricePro: row.pricePro,
    pricePremium: row.pricePremium,
  })
  return {
    landing_whatsapp_phone: row.landingWhatsappPhone ?? "",
    plan_prices,
    plan_configs: row.planConfigs ?? null,
    default_trial_days: row.defaultTrialDays,
    default_trial_plan: row.defaultTrialPlan,
    price_basic: row.priceBasic != null ? Number(row.priceBasic) : null,
    price_pro: row.pricePro != null ? Number(row.pricePro) : null,
    price_premium: row.pricePremium != null ? Number(row.pricePremium) : null,
    payment_api_enabled: row.paymentApiEnabled,
    payment_api_active: row.paymentApiEnabled || isPaymentApiEnabledFromEnv(),
  }
}

