"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

type WhatsAppPersonalizeSectionBlockProps = {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
  inactive?: boolean
}

export function WhatsAppPersonalizeSectionBlock({
  icon: Icon,
  title,
  description,
  children,
  inactive,
}: WhatsAppPersonalizeSectionBlockProps) {
  return (
    <section
      className={
        inactive
          ? "rounded-xl border border-dashed border-border/80 bg-muted/5 p-4 space-y-3 opacity-80"
          : "rounded-xl border border-border bg-card/50 p-4 space-y-4"
      }
    >
      <div className="flex gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
