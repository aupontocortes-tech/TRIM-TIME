"use client"

import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { PLAN_LABELS } from "@/lib/plans"
import { cn } from "@/lib/utils"

const PLAN_ORDER: SubscriptionPlan[] = ["basic", "pro", "premium"]

type PlanPickerProps = {
  catalog: PlanCatalog
  value: SubscriptionPlan
  onChange: (plan: SubscriptionPlan) => void
  className?: string
  compact?: boolean
}

export function PlanPicker({ catalog, value, onChange, className, compact }: PlanPickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      {PLAN_ORDER.map((p) => {
        const entry = catalog.plans[p]
        const label = entry?.name ?? PLAN_LABELS[p]
        const price = entry?.price ?? 0
        const selected = value === p
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 text-left transition-colors",
              compact ? "py-2 text-sm" : "py-3",
              selected
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40"
            )}
          >
            <div className="min-w-0">
              <span className="font-semibold block">{label}</span>
              {!compact && entry?.features?.[0] ? (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {entry.features[0]}
                </span>
              ) : null}
            </div>
            <span className={cn("font-semibold shrink-0 ml-2", selected ? "text-primary" : "")}>
              R$ {price}/mês
            </span>
          </button>
        )
      })}
    </div>
  )
}
