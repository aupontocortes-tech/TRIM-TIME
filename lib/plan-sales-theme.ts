import type { SubscriptionPlan } from "@/lib/db/types"
import { cn } from "@/lib/utils"

/** Cores dos planos na landing (#planos) — Básico azul, Pro âmbar/primary, Premium verde. */
export const PLAN_SALES_THEME: Record<
  SubscriptionPlan,
  {
    border: string
    price: string
    link: string
    check: string
    ring: string
    card: string
    cardCurrent: string
    button: string
    buttonCurrent: string
  }
> = {
  basic: {
    border: "border-blue-500",
    price: "text-blue-600",
    link: "text-blue-600",
    check: "text-blue-600",
    ring: "focus-visible:ring-blue-500",
    card: "border-border bg-secondary/10 hover:border-blue-500 hover:bg-blue-500/5",
    cardCurrent: "border-2 border-blue-500 bg-blue-500/10 shadow-sm shadow-blue-500/10",
    button: "border border-blue-500 text-blue-600 bg-transparent hover:bg-blue-500/10",
    buttonCurrent: "border border-blue-500/60 text-blue-600/80 bg-blue-500/10 cursor-default",
  },
  pro: {
    border: "border-amber-500",
    price: "text-primary",
    link: "text-primary",
    check: "text-primary",
    ring: "focus-visible:ring-amber-500",
    card: "border-border bg-secondary/10 hover:border-amber-500 hover:bg-amber-500/5",
    cardCurrent: "border-2 border-amber-500 bg-amber-500/10 shadow-sm shadow-amber-500/10",
    button: "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent",
    buttonCurrent: "bg-primary/50 text-primary-foreground border border-transparent cursor-default",
  },
  premium: {
    border: "border-green-600",
    price: "text-green-600",
    link: "text-green-600",
    check: "text-green-600",
    ring: "focus-visible:ring-green-600",
    card: "border-border bg-secondary/10 hover:border-green-600 hover:bg-green-600/5",
    cardCurrent: "border-2 border-green-600 bg-green-600/10 shadow-sm shadow-green-600/10",
    button: "border border-green-600 text-green-600 bg-transparent hover:bg-green-600/10",
    buttonCurrent: "border border-green-600/60 text-green-600/80 bg-green-600/10 cursor-default",
  },
}

export function planSalesTheme(plan: SubscriptionPlan) {
  return PLAN_SALES_THEME[plan]
}

/** Card da landing — `border-2` como na área de vendas. */
export function landingPlanCardClass(plan: SubscriptionPlan) {
  return cn("bg-card border-2", planSalesTheme(plan).border)
}

export function landingPlanButtonClass(plan: SubscriptionPlan) {
  const t = planSalesTheme(plan)
  return cn("w-full", t.button)
}

export function planSalesButtonVariant(plan: SubscriptionPlan): "outline" | "default" {
  return plan === "pro" ? "default" : "outline"
}
