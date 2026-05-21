"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PlanPicker } from "@/components/billing/plan-picker"
import { TrialBillingTrust } from "@/components/onboarding/trial-billing-trust"
import { TrialCardForm } from "@/components/billing/trial-card-form"
import type { SignupBillingMode } from "@/lib/billing/signup-mode"
import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { TRIAL_PLAN } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { ArrowLeft, Sparkles, Zap } from "lucide-react"

type Props = {
  catalog: PlanCatalog
  trialDays: number
  onSuccess: () => void
  onError?: (message: string) => void
}

export function SignupBillingFlow({ catalog, trialDays, onSuccess, onError }: Props) {
  const [step, setStep] = useState<"choose" | "card">("choose")
  const [mode, setMode] = useState<SignupBillingMode>("trial")
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("pro")

  const trialPlanName = catalog.plans[TRIAL_PLAN].name
  const trialPrice = catalog.plans[TRIAL_PLAN].price

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
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-sm space-y-3">
              <p className="font-semibold text-foreground">Contratar agora</p>
              <p className="text-muted-foreground text-xs">
                Confirme o plano (Básico, Pro ou Premium). A cobrança usa o valor do plano escolhido.
              </p>
              <PlanPicker
                catalog={catalog}
                value={selectedPlan}
                onChange={setSelectedPlan}
                compact
              />
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                Cobrança de{" "}
                <strong className="text-foreground">
                  R$ {catalog.plans[selectedPlan].price}/mês
                </strong>{" "}
                após validar o cartão — sem teste grátis.
              </p>
            </div>
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
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">Como você quer começar?</p>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setMode("trial")}
          className={cn(
            "text-left rounded-xl border-2 p-4 transition-colors",
            mode === "trial"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/40"
          )}
        >
          <div className="flex items-start gap-3">
            <Sparkles
              className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                mode === "trial" ? "text-primary" : "text-muted-foreground"
              )}
            />
            <div className="space-y-1 min-w-0">
              <p className="font-semibold">Teste grátis</p>
              <p className="text-sm text-muted-foreground">
                Plano {trialPlanName} por {trialDays} dias — R$ 0 hoje
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 pt-1">
                <li>• Cobrança automática de R$ {trialPrice}/mês após o teste</li>
                <li>• Cancele antes do fim do teste — sem cobrança</li>
              </ul>
            </div>
          </div>
        </button>

        <div
          className={cn(
            "rounded-xl border-2 transition-colors overflow-hidden",
            mode === "immediate"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border"
          )}
        >
          <button
            type="button"
            onClick={() => setMode("immediate")}
            className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Zap
                className={cn(
                  "w-5 h-5 shrink-0 mt-0.5",
                  mode === "immediate" ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div className="space-y-1 min-w-0">
                <p className="font-semibold">Contratar agora</p>
                <p className="text-sm text-muted-foreground">
                  Escolha Básico, Pro ou Premium — cobrança após cadastrar o cartão
                </p>
              </div>
            </div>
          </button>

          {mode === "immediate" ? (
            <div className="px-4 pb-4 pt-0 border-t border-primary/20 space-y-3">
              <p className="text-sm font-medium pt-3">Escolha seu plano</p>
              <PlanPicker catalog={catalog} value={selectedPlan} onChange={setSelectedPlan} />
            </div>
          ) : null}
        </div>
      </div>

      <Button type="button" className="w-full" onClick={() => setStep("card")}>
        {mode === "immediate"
          ? `Continuar com plano ${catalog.plans[selectedPlan].name}`
          : "Continuar com teste grátis"}
      </Button>
    </div>
  )
}
