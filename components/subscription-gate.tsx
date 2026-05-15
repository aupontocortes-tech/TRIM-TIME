"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CreditCard } from "lucide-react"

const ALLOW_PATHS = ["/painel/assinatura", "/painel/configuracoes", "/painel/suporte"]

type GateMode = "none" | "card" | "decision" | "blocked"

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState<GateMode>("none")

  useEffect(() => {
    if (ALLOW_PATHS.some((p) => pathname?.startsWith(p))) {
      setMode("none")
      setChecking(false)
      return
    }

    let cancelled = false
    setChecking(true)
    fetch("/api/billing", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
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
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Cadastre seu cartão
            </CardTitle>
            <CardDescription>
              Para usar os <strong>7 dias grátis</strong>, cadastre um cartão de crédito. Você só
              será cobrado se aceitar um plano após o período de teste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/painel/assinatura?setup=card">Cadastrar cartão agora</Link>
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
              Deseja continuar com um plano pago? Se recusar, não haverá cobrança no seu cartão.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/painel/assinatura?decision=1">Responder agora</Link>
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
