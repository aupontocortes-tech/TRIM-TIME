"use client"

import { Gift, Sparkles } from "lucide-react"
import type { LoyaltyClientStatus } from "@/lib/db/types"

type LoyaltyGuestHintProps = {
  rewardLabel: string
  visitsRequired: number
  /** Na tela de cadastro, oferece atalho para entrar e ver o progresso. */
  showLoginLink?: boolean
  onLoginClick?: () => void
}

type LoyaltyProgressStripProps = {
  status: LoyaltyClientStatus
}

/**
 * Preview antes do login — só quando o dono ativou fidelidade (dados públicos da barbearia).
 */
export function LoyaltyGuestHint({
  rewardLabel,
  visitsRequired,
  showLoginLink = false,
  onLoginClick,
}: LoyaltyGuestHintProps) {
  const label = rewardLabel.trim()
  if (!label || !Number.isFinite(visitsRequired) || visitsRequired < 1) return null

  return (
    <div
      className="mb-5 rounded-lg border border-border/50 bg-muted/25 px-3 py-2.5"
      role="note"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 shrink-0">
          <Gift className="h-3.5 w-3.5 text-primary/80" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground leading-snug">
            A cada{" "}
            <span className="font-semibold text-foreground tabular-nums">{visitsRequired}</span>{" "}
            visita{visitsRequired === 1 ? "" : "s"} você ganha{" "}
            <span className="font-medium text-foreground">{label}</span>.
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {showLoginLink ? (
              <>
                Já é cliente?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline underline-offset-2"
                  onClick={onLoginClick}
                >
                  Entre para acompanhar suas visitas
                </button>
                .
              </>
            ) : (
              "Entre na sua conta para acompanhar quantas visitas faltam."
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Faixa discreta de fidelidade no app de agendamento do cliente.
 * Só deve ser renderizada quando o dono ativou o programa (Premium) e o cliente está logado.
 */
export function LoyaltyProgressStrip({ status }: LoyaltyProgressStripProps) {
  if (!status.enabled) return null

  const ready = status.reward_available

  return (
    <div
      className={
        ready
          ? "rounded-lg border border-green-500/20 bg-green-500/[0.06] px-3 py-2.5"
          : "rounded-lg border border-border/50 bg-muted/25 px-3 py-2.5"
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <div
          className={
            ready
              ? "mt-0.5 rounded-full bg-green-500/15 p-1.5 shrink-0"
              : "mt-0.5 rounded-full bg-primary/10 p-1.5 shrink-0"
          }
        >
          {ready ? (
            <Sparkles className="h-3.5 w-3.5 text-green-600" aria-hidden />
          ) : (
            <Gift className="h-3.5 w-3.5 text-primary/80" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            {ready ? (
              <p className="font-medium text-green-700 dark:text-green-500">
                Sua recompensa está disponível
              </p>
            ) : (
              <p className="text-muted-foreground">
                Faltam{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {status.visits_remaining}
                </span>{" "}
                visita{status.visits_remaining === 1 ? "" : "s"}
              </p>
            )}
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {status.current_visits}/{status.visits_required}
            </span>
          </div>

          <div className="h-1 w-full overflow-hidden rounded-full bg-border/70">
            <div
              className={
                ready
                  ? "h-full rounded-full bg-green-500 transition-all duration-500"
                  : "h-full rounded-full bg-primary/70 transition-all duration-500"
              }
              style={{ width: `${status.progress_percent}%` }}
            />
          </div>

          <p className="truncate text-[11px] leading-snug text-muted-foreground">
            {ready ? (
              <>
                Peça na barbearia:{" "}
                <span className="font-medium text-foreground">{status.reward_label}</span>
              </>
            ) : (
              <>
                Próxima recompensa:{" "}
                <span className="font-medium text-foreground">{status.reward_label}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
