"use client"

import { Gift } from "lucide-react"
import type { LoyaltyClientStatus } from "@/lib/db/types"

type LoyaltyAgendaBadgeProps = {
  status: LoyaltyClientStatus
}

/** Indicador compacto de fidelidade na agenda do painel. */
export function LoyaltyAgendaBadge({ status }: LoyaltyAgendaBadgeProps) {
  if (!status.enabled) return null

  if (status.reward_available) {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600 shrink-0"
        title={`Recompensa disponível: ${status.reward_label}`}
      >
        <Gift className="h-3 w-3" aria-hidden />
        Pronto
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums shrink-0"
      title={`Faltam ${status.visits_remaining} visita${status.visits_remaining === 1 ? "" : "s"} para ${status.reward_label}`}
    >
      {status.current_visits}/{status.visits_required}
    </span>
  )
}
