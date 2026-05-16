"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CreditCard, CalendarClock } from "lucide-react"
import { TrialBillingTrust } from "@/components/onboarding/trial-billing-trust"
import { TRIAL_DAYS, normalizeTrialDays } from "@/lib/plans"

const ALLOW_PATHS = ["/painel/assinatura", "/painel/configuracoes", "/painel/suporte"]

type GateMode = "none" | "card" | "decision" | "grace" | "blocked"

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<GateMode>("none")
  const [trialDays, setTrialDays] = useState(TRIAL_DAYS)
  const [graceUntil, setGraceUntil] = useState<string | null>(null)

  useEffect(() => {
    if (ALLOW_PATHS.some((p) => pathname?.startsWith(p))) {
      setMode("none")
      setChecking(false)
      return
    }

    let cancelled = false
    setChecking(true)
    setTrialDays(TRIAL_DAYS)
    setGraceUntil(null)
    fetch("/api/billing", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        const d = j?.catalog?.trialDays
        if (typeof d === "number" && d > 0) setTrialDays(normalizeTrialDays(d))
        if (j?.billing_exempt) {
          setMode("none")
          return
        }
        if (j?.requires_card_setup) {
          setMode("card")
          return
        }
        if (j?.needs_trial_decision) {
          setMode("decision")
          return
        }
        if (j?.in_decline_grace_period) {
          setGraceUntil(typeof j.grace_access_until === "string" ? j.grace_access_until : null)
          setMode("grace")
          return
        }
        if (j?.needs_plan_choice && !j?.effective_plan) {
          setMode("blocked")
          return
        }
        setMode("none")
      })
      .catch(() => setMode("none"))
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [pathname])

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (mode === "none") return <>{children}</>

  if (mode === "card") {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-4">
        <Card className="border-primary/30 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Cadastre seu cartão para começar
            </CardTitle>
            <CardDescription>
              Você está a um passo de usar o painel com <strong>{trialDays} dias grátis</strong> no plano Pro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrialBillingTrust trialDays={trialDays} compact />
            <Button asChild className="w-full">
              <Link href="/painel/assinatura?setup=card">Continuar para cadastro do cartão</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (mode === "decision") {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Seu teste grátis terminou</CardTitle>
            <CardDescription>
              Deseja continuar? Escolha um plano (Básico, Pro ou Premium). Se recusar,{" "}
              <strong>não haverá cobrança</strong> no seu cartão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/painel/assinatura?decision=1">Escolher agora</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (mode === "grace") {
    const graceLabel = graceUntil
      ? new Date(graceUntil).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5" />
              Conta em modo limitado
            </CardTitle>
            <CardDescription>
              Você optou por não contratar após o teste. Seus dados permanecem salvos
              {graceLabel ? ` até ${graceLabel}` : " por alguns dias"}. Nenhuma cobrança foi feita.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/painel/assinatura">Reativar com um plano</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/painel/configuracoes">Configurações da conta</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>Acesso indisponível</CardTitle>
          <CardDescription>
            Sua assinatura não está ativa. Contrate um plano ou entre em contato com o suporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/painel/assinatura">Ver assinatura</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
