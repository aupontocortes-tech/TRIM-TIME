"use client"

import { useEffect, useState } from "react"
import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { PLAN_PRICES } from "@/lib/plans"

function pricesFromCatalog(catalog: PlanCatalog | null): Record<SubscriptionPlan, number> {
  if (!catalog?.plans) return { ...PLAN_PRICES }
  return {
    basic: catalog.plans.basic.price,
    pro: catalog.plans.pro.price,
    premium: catalog.plans.premium.price,
  }
}

/** Preços e catálogo do Super ADM (`platform_settings`), com fallback em `PLAN_PRICES`. */
export function usePlanCatalog() {
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/public/plan-catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: PlanCatalog | null) => {
        if (!cancelled && j?.plans) setCatalog(j)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return { catalog, prices: pricesFromCatalog(catalog) }
}
