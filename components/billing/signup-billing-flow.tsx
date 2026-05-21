"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TrialBillingTrust } from "@/components/onboarding/trial-billing-trust"
import { TrialCardForm } from "@/components/billing/trial-card-form"
import type { SignupBillingMode } from "@/lib/billing/signup-mode"
import type { SubscriptionPlan } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { TRIAL_PLAN } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { ArrowLeft, Sparkles, Zap } from "lucide-react"

const PLAN_ORDER: SubscriptionPlan[] = ["basic", "pro", "premium"]

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
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-sm space-y-2">
            <p className="font-semibold text-foreground">
              Contratar agora — {catalog.plans[selectedPlan].name}
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>✓ Acesso completo imediato ao plano escolhido</li>
              <li>
                ✓ Cobrança de <strong className="text-foreground">R$ {catalog.plans[selectedPlan].price}/mês</strong>{" "}
                após confirmar o cartão
              </li>
              <li>✓ Sem período de teste grátis neste caminho</li>
            </ul>
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

        <button
          type="button"
          onClick={() => setMode("immediate")}
          className={cn(
            "text-left rounded-xl border-2 p-4 transition-colors",
            mode === "immediate"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/40"
          )}
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
                Escolha o plano e comece hoje — cobrança após o cartão
              </p>
            </div>
          </div>
        </button>
      </div>

      {mode === "immediate" ? (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium mb-3">Escolha seu plano</p>
            <div className="grid gap-2">
              {PLAN_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlan(p)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    selectedPlan === p
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <span className="font-medium">{catalog.plans[p].name}</span>
                  <span className="text-primary font-semibold">
                    R$ {catalog.plans[p].price}/mês
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Button type="button" className="w-full" onClick={() => setStep("card")}>
        Continuar
      </Button>
    </div>
  )
}
