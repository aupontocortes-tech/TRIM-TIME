"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlanPicker } from "@/components/billing/plan-picker"
import { TrialBillingTrust } from "@/components/onboarding/trial-billing-trust"
import { TrialCardForm } from "@/components/billing/trial-card-form"
import type { SignupBillingMode } from "@/lib/billing/signup-mode"
import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { planSalesTheme } from "@/lib/plan-sales-theme"
import { TRIAL_PLAN } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { ArrowLeft, CalendarDays, Rocket, Sparkles } from "lucide-react"

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
              planSalesTheme(selectedPlan).cardCurrent
            )}
          >
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Plano {selectedPlanName}</p>
                <p className="text-sm text-muted-foreground">
                  R$ {selectedPlanPrice}/mês — ativa assim que o cartão for validado
                </p>
              </div>
            </div>
            <PlanPicker
              catalog={catalog}
              value={selectedPlan}
              onChange={pickPlan}
              compact
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
          Contrate direto e use tudo hoje, ou experimente grátis por {trialDays} dias.
        </p>
      </div>

      {/* Contratar agora — opção principal (visual) */}
      <div
        className={cn(
          "relative rounded-2xl border-2 transition-all overflow-hidden",
          mode === "immediate"
            ? "border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-md shadow-primary/10 ring-2 ring-primary/20"
            : "border-primary/50 bg-gradient-to-br from-primary/10 via-primary/[0.03] to-transparent hover:border-primary/70"
        )}
      >
        <span className="absolute top-3 right-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
          Recomendado
        </span>

        <button
          type="button"
          onClick={() => setMode("immediate")}
          className="w-full text-left p-5 pb-3 hover:bg-primary/[0.03] transition-colors"
        >
          <div className="flex items-start gap-3 pr-16">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                mode === "immediate" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
              )}
            >
              <Rocket className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-lg font-bold text-foreground">Contratar agora</p>
              <p className="text-sm text-muted-foreground">
                Escolha Básico, Pro ou Premium — painel liberado na hora
              </p>
            </div>
          </div>
        </button>

        <div className="px-5 pb-5 space-y-3">
          <PlanPicker catalog={catalog} value={selectedPlan} onChange={pickPlan} />
          <p className="text-xs text-muted-foreground rounded-lg bg-background/60 border border-border/60 px-3 py-2">
            Cobrança de{" "}
            <strong className={planSalesTheme(selectedPlan).price}>
              R$ {selectedPlanPrice}/mês
            </strong>{" "}
            após validar o cartão — sem período de teste.
          </p>
        </div>
      </div>

      {/* Teste grátis — opção secundária */}
      <button
        type="button"
        onClick={() => setMode("trial")}
        className={cn(
          "w-full text-left rounded-2xl border-2 p-4 transition-all",
          mode === "trial"
            ? "border-muted-foreground/30 bg-muted/40 shadow-sm"
            : "border-border/80 bg-muted/20 hover:border-muted-foreground/25 hover:bg-muted/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              mode === "trial" ? "bg-muted text-foreground" : "bg-muted/80 text-muted-foreground"
            )}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">Teste grátis</p>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <CalendarDays className="w-3 h-3" />
                {trialDays} dias
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Plano {trialPlanName} — R$ 0 hoje, depois R$ {trialPrice}/mês se continuar
            </p>
            <p className="text-xs text-muted-foreground/90 pt-0.5">
              Cancele antes do fim — sem cobrança
            </p>
          </div>
        </div>
      </button>

      {mode === "immediate" ? (
        <Button type="button" className="w-full h-11 text-base font-semibold shadow-md" onClick={() => setStep("card")}>
          <Rocket className="w-4 h-4 mr-2" />
          Contratar {selectedPlanName} — R$ {selectedPlanPrice}/mês
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 text-base"
          onClick={() => setStep("card")}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Começar teste grátis ({trialDays} dias no {trialPlanName})
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Pagamento seguro · cancele quando quiser
      </p>
    </div>
  )
}
