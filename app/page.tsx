import { Suspense } from "react"
import { LandingPageClient } from "@/components/landing/landing-page-client"
import {
  getEffectivePlanPrices,
  resolveLandingWhatsappUrl,
} from "@/lib/platform-settings"
import { formatPlanPricesMap } from "@/lib/format-plan-price"
import { PLAN_PRICES } from "@/lib/plans"

export const dynamic = "force-dynamic"

export default async function LandingPage() {
  let initialWhatsappUrl: string | null = null
  let initialPlanPrices = PLAN_PRICES
  let initialPlanPriceLabels = formatPlanPricesMap(PLAN_PRICES)

  try {
    const [whatsappUrl, planPrices] = await Promise.all([
      resolveLandingWhatsappUrl(),
      getEffectivePlanPrices(),
    ])
    initialWhatsappUrl = whatsappUrl
    initialPlanPrices = planPrices
    initialPlanPriceLabels = formatPlanPricesMap(planPrices)
  } catch {
    /* cliente refaz fetch em useEffect */
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LandingPageClient
        initialWhatsappUrl={initialWhatsappUrl}
        initialPlanPrices={initialPlanPrices}
        initialPlanPriceLabels={initialPlanPriceLabels}
      />
    </Suspense>
  )
}
