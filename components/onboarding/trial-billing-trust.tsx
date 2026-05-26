"use client"

import { ShieldCheck } from "lucide-react"
import { trialTrustBullets } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

type Props = {
  trialDays: number
  className?: string
  compact?: boolean
}

export function TrialBillingTrust({ trialDays, className, compact }: Props) {
  const bullets = trialTrustBullets(trialDays)

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-4 text-sm",
        className
      )}
    >
      <div className="flex gap-3">
        <ShieldCheck
          className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
          aria-hidden
        />
        <div className="space-y-2 min-w-0">
          {!compact ? (
            <p className="font-semibold text-foreground leading-snug">
              Teste grátis no plano Pro — {trialDays} dias com todos os recursos Pro
            </p>
          ) : null}
          <ul className="space-y-1.5 text-muted-foreground">
            {bullets.map((text) => (
              <li key={text} className="flex gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
