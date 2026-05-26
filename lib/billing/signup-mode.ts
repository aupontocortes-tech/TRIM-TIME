import type { SubscriptionPlan } from "@/lib/db/types"

/** Caminho escolhido no cadastro / ativação do cartão. */
export type SignupBillingMode = "trial" | "immediate"

export function isSignupBillingMode(v: unknown): v is SignupBillingMode {
  return v === "trial" || v === "immediate"
}

export function parseSignupBillingMode(
  v: unknown,
  plan?: unknown
): { mode: SignupBillingMode; plan: SubscriptionPlan | null } | string {
  if (!isSignupBillingMode(v)) return "Escolha teste grátis ou contratar agora."
  if (v === "immediate") {
    const p = plan as string
    if (p !== "basic" && p !== "pro" && p !== "premium") {
      return "Selecione um plano para contratar agora."
    }
    return { mode: v, plan: p }
  }
  return { mode: v, plan: null }
}
