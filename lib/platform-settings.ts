import type { SubscriptionPlan } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import {
  defaultPlanPrices,
  isPaymentApiEnabledFromEnv,
  mergePlanPricesFromDb,
  type PlanPricesMap,
} from "@/lib/plan-prices"

const SINGLETON_ID = "singleton"

export function normalizeWhatsappPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "")
}

/** Dígitos com DDI 55 para wa.me (Brasil). */
export function whatsappDigitsForWaMe(raw: string): string | null {
  const d = normalizeWhatsappPhoneDigits(raw)
  if (d.length < 10) return null
  if (d.startsWith("55") && d.length >= 12) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  if (d.length >= 12) return d
  return null
}

export function buildLandingWhatsappUrl(phoneDigits: string): string {
  const d = whatsappDigitsForWaMe(phoneDigits)
  if (!d) return ""
  const text = encodeURIComponent("Olá! Tenho dúvidas sobre o Trim Time.")
  return `https://wa.me/${d}?text=${text}`
}

export async function getPlatformSettings() {
  const row = await prisma.platformSettings.findUnique({
    where: { id: SINGLETON_ID },
  })
  if (row) return row
  return prisma.platformSettings.create({
    data: { id: SINGLETON_ID },
  })
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

