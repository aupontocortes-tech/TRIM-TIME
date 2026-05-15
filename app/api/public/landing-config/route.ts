import { NextResponse } from "next/server"
import {
  getEffectivePlanPrices,
  getLandingWhatsappPhone,
  isPaymentApiActive,
  resolveLandingWhatsappUrl,
} from "@/lib/platform-settings"
import { TRIAL_DAYS, PLAN_PRICES } from "@/lib/plans"

export async function GET() {
  try {
    const [phone, whatsapp_url, plan_prices, payment_api_active] = await Promise.all([
      getLandingWhatsappPhone(),
      resolveLandingWhatsappUrl(),
      getEffectivePlanPrices(),
      isPaymentApiActive(),
    ])
    return NextResponse.json({
      trial_days: TRIAL_DAYS,
      whatsapp_phone: phone,
      whatsapp_url: whatsapp_url || null,
      plan_prices,
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
