"use client"

import { Gift, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { LoyaltyClientStatus } from "@/lib/db/types"

type LoyaltyCardProps = {
  status: LoyaltyClientStatus
  compact?: boolean
}

export function LoyaltyCard({ status, compact = false }: LoyaltyCardProps) {
  if (!status.enabled) return null

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
      <CardContent className={compact ? "p-4 space-y-3" : "p-5 space-y-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-full bg-primary/15 p-2 shrink-0">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Programa de fidelidade</p>
              <p className="text-xs text-muted-foreground truncate">{status.reward_label}</p>
            </div>
          </div>
          {status.reward_available ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-600 shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
              Disponível
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-foreground font-medium">
              {status.reward_available
                ? `Você completou ${status.visits_required} visitas!`
                : `Você possui ${status.current_visits} de ${status.visits_required} visitas`}
            </span>
            <span className="text-primary font-bold tabular-nums">{status.progress_percent}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${status.progress_percent}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-snug">
          {status.reward_available ? (
            <span className="text-foreground font-medium">
              Parabéns! Sua recompensa <strong className="text-primary">{status.reward_label}</strong> está
              disponível. Peça na barbearia no próximo atendimento.
            </span>
          ) : (
            <>
              Faltam{" "}
              <strong className="text-foreground">
                {status.visits_remaining} visita{status.visits_remaining === 1 ? "" : "s"}
              </strong>{" "}
              para ganhar <strong className="text-primary">{status.reward_label}</strong>.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
