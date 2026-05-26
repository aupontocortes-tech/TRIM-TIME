"use client"

import { Check } from "lucide-react"
import { SIGNUP_STEPS, signupStepIndex, type SignupFlowStep } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

type Props = {
  current: SignupFlowStep
  className?: string
}

export function SignupProgress({ current, className }: Props) {
  const currentIdx = signupStepIndex(current)

  return (
    <nav aria-label="Progresso do cadastro" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between gap-1">
        {SIGNUP_STEPS.map((step, idx) => {
          const done = idx < currentIdx
          const active = idx === currentIdx
          return (
            <li key={step.id} className="flex flex-1 flex-col items-center min-w-0">
              <span
                className={cn(
                  "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !done && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border bg-muted/30 text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : idx + 1}
              </span>
              <span
                className={cn(
                  "mt-2 text-[10px] sm:text-xs text-center leading-tight truncate w-full px-0.5",
                  active ? "font-semibold text-primary" : done ? "text-foreground/80" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
