import { NextResponse } from "next/server"
import {
  getEffectivePlanPrices,
  getLandingWhatsappPhone,
  isPaymentApiActive,
  resolveLandingWhatsappUrl,
} from "@/lib/platform-settings"
import { formatPlanPricesMap } from "@/lib/format-plan-price"
import { PLAN_PRICES, TRIAL_DAYS } from "@/lib/plans"
import { getPlanCatalog, getPublicTrialDays } from "@/lib/plan-catalog"

export async function GET() {
  try {
    const [phone, whatsapp_url, plan_prices, payment_api_active, trial_days, catalog] =
      await Promise.all([
        getLandingWhatsappPhone(),
        resolveLandingWhatsappUrl(),
        getEffectivePlanPrices(),
        isPaymentApiActive(),
        getPublicTrialDays(),
        getPlanCatalog(),
      ])
    return NextResponse.json({
      trial_days,
      plan_catalog: catalog.plans,
      whatsapp_phone: phone,
      whatsapp_url: whatsapp_url || null,
      plan_prices,
      plan_price_labels: formatPlanPricesMap(plan_prices),
      payment_api_active,
    })
  } catch (e) {
    console.error("[public/landing-config]", e)
    return NextResponse.json(
      {
        trial_days: TRIAL_DAYS,
        whatsapp_phone: null,
        whatsapp_url: null,
        plan_prices: PLAN_PRICES,
        payment_api_active: false,
      },
      { status: 200 }
    )
  }
}
