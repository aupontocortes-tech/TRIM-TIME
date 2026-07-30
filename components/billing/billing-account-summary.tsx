"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { BillingAccountSummary } from "@/lib/billing-account-summary"
import { CreditCard, CalendarClock, Receipt, ShieldCheck } from "lucide-react"

type Props = {
  summary: BillingAccountSummary
  showManageLink?: boolean
  compact?: boolean
}

export function BillingAccountSummaryCard({ summary, showManageLink = true, compact = false }: Props) {
  return (
    <Card className={compact ? "border-border" : "border-primary/20"}>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className={compact ? "text-base" : "text-lg"}>
              Sua assinatura e pagamento
            </CardTitle>
            <CardDescription>
              Informações claras sobre o plano contratado, forma de pagamento e próximas cobranças.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{summary.status_label}</Badge>
            <Badge>{summary.plan_name}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5 mb-1">
              <Receipt className="w-4 h-4" />
              Plano contratado
            </dt>
            <dd className="font-semibold text-foreground">{summary.plan_name}</dd>
            <dd className="text-primary font-bold mt-1">{summary.monthly_amount_text}/mês</dd>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5 mb-1">
              <CalendarClock className="w-4 h-4" />
              {summary.trial_active ? "Primeira cobrança" : "Próxima cobrança"}
            </dt>
            <dd className="font-semibold text-foreground">
              {summary.next_charge_date ?? "A confirmar"}
            </dd>
            {summary.billing_day_of_month != null ? (
              <dd className="text-xs text-muted-foreground mt-1">
                Todo dia {summary.billing_day_of_month} de cada mês
              </dd>
            ) : null}
          </div>

          {summary.billing_type_label ? (
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <dt className="text-muted-foreground mb-1">Forma de pagamento</dt>
              <dd className="font-semibold text-foreground">{summary.billing_type_label}</dd>
            </div>
          ) : null}

          {summary.card_display ? (
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <dt className="text-muted-foreground flex items-center gap-1.5 mb-1">
                <CreditCard className="w-4 h-4" />
                Cartão cadastrado
              </dt>
              <dd className="font-semibold text-foreground font-mono tracking-wide">
                Final {summary.card_display}
              </dd>
            </div>
          ) : summary.card_registered && summary.billing_type !== "PIX" ? (
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <dt className="text-muted-foreground flex items-center gap-1.5 mb-1">
                <CreditCard className="w-4 h-4" />
                Cartão cadastrado
              </dt>
              <dd className="text-sm text-muted-foreground">
                Cartão salvo. Troque o cartão em &quot;Gerenciar assinatura&quot; para exibir o final aqui.
              </dd>
            </div>
          ) : null}

          {summary.trial_active && summary.trial_days_left > 0 ? (
            <div className="rounded-lg border border-border bg-secondary/20 p-3 sm:col-span-2">
              <dt className="text-muted-foreground mb-1">Período de teste</dt>
              <dd className="font-semibold text-foreground">
                {summary.trial_days_left} dia(s) restante(s)
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <p>{summary.billing_cycle_text}</p>
        </div>

        {showManageLink ? (
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/painel/assinatura">Gerenciar assinatura e cartão</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
