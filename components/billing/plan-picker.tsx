"use client"

import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { landingPlanCardClass, planSalesTheme } from "@/lib/plan-sales-theme"
import { PLAN_LABELS } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { formatPlanPrice, formatPlanPricePerMonth } from "@/lib/format-plan-price"
import { Check } from "lucide-react"

const PLAN_ORDER: SubscriptionPlan[] = ["basic", "pro", "premium"]

const PLAN_TAGLINE: Record<SubscriptionPlan, string> = {
  basic: "Para começar",
  pro: "Para crescer",
  premium: "Tudo incluso",
}

type PlanPickerProps = {
  catalog: PlanCatalog
  value: SubscriptionPlan
  onChange: (plan: SubscriptionPlan) => void
  className?: string
  compact?: boolean
  variant?: "default" | "sales"
}

export function PlanPicker({
  catalog,
  value,
  onChange,
  className,
  compact,
  variant = "default",
}: PlanPickerProps) {
  if (variant === "sales") {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
        {PLAN_ORDER.map((p) => {
          const entry = catalog.plans[p]
          const label = entry?.name ?? PLAN_LABELS[p]
          const price = entry?.price ?? 0
          const selected = value === p
          const theme = planSalesTheme(p)

          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "relative flex flex-col rounded-xl border-2 p-3 text-left transition-all duration-200",
                "hover:scale-[1.02] active:scale-[0.98]",
                selected ? theme.cardCurrent : cn(landingPlanCardClass(p), "opacity-90 hover:opacity-100")
              )}
            >
              {p === "pro" ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
                  Popular
                </span>
              ) : null}
              <span className="text-sm font-semibold text-foreground">{label}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{PLAN_TAGLINE[p]}</span>
              <div className="mt-2 flex items-baseline gap-0.5">
                <span className={cn("text-xl font-bold", theme.price)}>{formatPlanPrice(price)}</span>
                <span className="text-[10px] text-muted-foreground">/mês</span>
              </div>
              {selected ? (
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-[10px] font-medium",
                    theme.check
                  )}
                >
                  <Check className="w-3 h-3" />
                  Selecionado
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {PLAN_ORDER.map((p) => {
        const entry = catalog.plans[p]
        const label = entry?.name ?? PLAN_LABELS[p]
        const price = entry?.price ?? 0
        const selected = value === p
        const theme = planSalesTheme(p)

        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "flex items-center justify-between rounded-lg border-2 px-3 text-left transition-all duration-200",
              compact ? "py-2 text-sm" : "py-3",
              selected ? theme.cardCurrent : cn(theme.card, "border-border")
            )}
          >
            <div className="min-w-0">
              <span className={cn("font-semibold block", selected ? theme.price : "")}>{label}</span>
              {!compact && entry?.features?.[0] ? (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {entry.features[0]}
                </span>
              ) : null}
            </div>
            <span className={cn("font-semibold shrink-0 ml-2", selected ? theme.price : "")}>
              {formatPlanPricePerMonth(price)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
