"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlanPicker } from "@/components/billing/plan-picker"
import { TrialBillingTrust } from "@/components/onboarding/trial-billing-trust"
import { TrialCardForm } from "@/components/billing/trial-card-form"
import type { SignupBillingMode } from "@/lib/billing/signup-mode"
import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { landingPlanButtonClass, planSalesTheme } from "@/lib/plan-sales-theme"
import { formatPlanPricePerMonth } from "@/lib/format-plan-price"
import { TRIAL_PLAN } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { ArrowLeft, Gift, PartyPopper, Rocket, Sparkles } from "lucide-react"

type Props = {
  catalog: PlanCatalog
  trialDays: number
  onSuccess: () => void
  onError?: (message: string) => void
}

export function SignupBillingFlow({ catalog, trialDays, onSuccess, onError }: Props) {
  const [step, setStep] = useState<"choose" | "card">("choose")
  const [mode, setMode] = useState<SignupBillingMode>("trial")
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("basic")

  const pickPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan)
    setMode("immediate")
  }

  const trialPlanName = catalog.plans[TRIAL_PLAN].name
  const trialPrice = catalog.plans[TRIAL_PLAN].price
  const selectedPlanName = catalog.plans[selectedPlan].name
  const selectedPlanPrice = catalog.plans[selectedPlan].price
  const hireTheme = planSalesTheme(selectedPlan)

  if (step === "card") {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => setStep("choose")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>

        {mode === "trial" ? (
          <TrialBillingTrust trialDays={trialDays} />
        ) : (
          <div
            className={cn(
              "rounded-2xl border-2 px-4 py-4 space-y-3",
              hireTheme.cardCurrent
            )}
          >
            <div className="flex items-center gap-2">
              <Rocket className={cn("w-5 h-5 shrink-0", hireTheme.price)} />
              <div>
                <p className="font-semibold text-foreground">Plano {selectedPlanName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPlanPricePerMonth(selectedPlanPrice)} — ativa assim que o cartão for validado
                </p>
              </div>
            </div>
            <PlanPicker
              catalog={catalog}
              value={selectedPlan}
              onChange={pickPlan}
              variant="sales"
            />
          </div>
        )}

        <TrialCardForm
          mode={mode}
          plan={mode === "immediate" ? selectedPlan : TRIAL_PLAN}
          trialDays={trialDays}
          catalog={catalog}
          onSuccess={onSuccess}
          onError={onError}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1 px-1">
        <p className="text-base font-semibold text-foreground">Quase lá — escolha como começar</p>
        <p className="text-sm text-muted-foreground">
          Contrate direto ou comece grátis — você troca de plano quando quiser.
        </p>
      </div>

      {/* Contratar agora — planos com cores da landing */}
      <div
        className={cn(
          "rounded-2xl border-2 transition-all duration-300 overflow-hidden",
          mode === "immediate"
            ? cn("shadow-md", hireTheme.cardCurrent)
            : "border-border/80 bg-card/40 hover:border-border"
        )}
      >
        <button
          type="button"
          onClick={() => setMode("immediate")}
          className="w-full text-left p-5 pb-3 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2",
                mode === "immediate"
                  ? cn(hireTheme.border, "bg-background")
                  : "border-border bg-muted/30"
              )}
            >
              <Rocket
                className={cn(
                  "w-5 h-5",
                  mode === "immediate" ? hireTheme.price : "text-muted-foreground"
                )}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-base font-bold text-foreground">Contratar agora</p>
              <p className="text-sm text-muted-foreground">
                Escolha Básico, Pro ou Premium — painel liberado na hora
              </p>
            </div>
          </div>
        </button>

        <div className="px-5 pb-5 space-y-3">
          <PlanPicker
            catalog={catalog}
            value={selectedPlan}
            onChange={pickPlan}
            variant="sales"
          />
          <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            Cobrança de{" "}
            <strong className={hireTheme.price}>{formatPlanPricePerMonth(selectedPlanPrice)}</strong> após validar o
            cartão — sem período de teste.
          </p>
        </div>
      </div>

      {/* Teste grátis — padrão ativo, visual amigável */}
      <button
        type="button"
        onClick={() => setMode("trial")}
        className={cn(
          "group w-full text-left rounded-2xl border-2 p-5 transition-all duration-300 overflow-hidden relative",
          mode === "trial"
            ? "border-emerald-400/70 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-violet-500/10 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-400/25 scale-[1.01]"
            : "border-border/80 bg-muted/15 hover:border-emerald-400/40 hover:bg-emerald-500/5"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300",
            mode === "trial" ? "bg-emerald-400/30 opacity-100" : "bg-emerald-400/10 opacity-0 group-hover:opacity-60"
          )}
        />

        <div className="relative flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-300",
              mode === "trial"
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            )}
          >
            <Sparkles
              className={cn("w-5 h-5", mode === "trial" && "animate-pulse")}
            />
          </div>

          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold text-foreground">Teste grátis</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm",
                  mode === "trial"
                    ? "bg-gradient-to-r from-amber-500 to-amber-400 text-white animate-pulse"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                )}
              >
                <Gift className="w-3.5 h-3.5" />
                {trialDays} dias no {trialPlanName}
              </span>
            </div>

            <p className="text-sm text-foreground/90">
              R$ <strong className="text-emerald-600 dark:text-emerald-400">0 hoje</strong> — explore
              tudo no plano {trialPlanName} sem compromisso
            </p>

            <ul className="text-xs text-muted-foreground space-y-1 pt-0.5">
              <li className="flex items-center gap-2">
                <PartyPopper className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                Cartão só para validar — sem cobrança no teste
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                Depois {formatPlanPricePerMonth(trialPrice)} se continuar · cancele antes e pague nada
              </li>
            </ul>
          </div>
        </div>
      </button>

      {mode === "trial" ? (
        <Button
          type="button"
          className={cn(
            "w-full h-12 text-base font-semibold shadow-lg transition-all duration-300",
            "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500",
            "text-white border-0 hover:scale-[1.01] active:scale-[0.99]"
          )}
          onClick={() => setStep("card")}
        >
          <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
          Continuar com teste grátis — R$ 0 hoje
        </Button>
      ) : (
        <Button
          type="button"
          className={cn(
            "w-full h-12 text-base font-semibold transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]",
            landingPlanButtonClass(selectedPlan)
          )}
          onClick={() => setStep("card")}
        >
          <Rocket className="w-4 h-4 mr-2" />
          Contratar {selectedPlanName} — {formatPlanPricePerMonth(selectedPlanPrice)}
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Pagamento seguro · cancele quando quiser
      </p>
    </div>
  )
}
