"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { PLAN_LABELS, PLAN_PRICES } from "@/lib/plans"
import type { SubscriptionPlan } from "@/lib/db/types"
import { Zap } from "lucide-react"

interface UpgradePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: string
  suggestedPlan?: SubscriptionPlan
}

export function UpgradePlanDialog({
  open,
  onOpenChange,
  message = "Este recurso não está disponível no seu plano. Faça upgrade para desbloquear.",
  suggestedPlan = "pro",
}: UpgradePlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Faça upgrade de plano</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {message}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Confira os planos disponíveis e escolha o que melhor atende sua barbearia.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["basic", "pro", "premium"] as const).map((plan) => (
              <div
                key={plan}
                className={`px-4 py-2 rounded-lg border ${
                  plan === suggestedPlan
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/30 text-foreground"
                }`}
              >
                <span className="font-medium">{PLAN_LABELS[plan]}</span>
                <span className="text-muted-foreground ml-1">
                  R${PLAN_PRICES[plan]}/mês
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-border"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                onOpenChange(false)
                window.location.href = "/admin/configuracoes?tab=plan"
              }}
            >
              Ver planos
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
