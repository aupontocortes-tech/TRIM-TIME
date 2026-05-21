"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CreditCard, QrCode, ArrowLeft, CheckCircle2 } from "lucide-react"
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/db/types"
import type { PlanCatalog } from "@/lib/plan-catalog"
import { TrialBillingTrust } from "@/components/onboarding/trial-billing-trust"
import { TrialCardForm } from "@/components/billing/trial-card-form"
import { TRIAL_DAYS } from "@/lib/plans"

type BillingSubscription = {
  plan: SubscriptionPlan
  status: SubscriptionStatus
  trial_end: string | null
  next_payment: string | null
  billing_type: string | null
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Período de teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
}

const PLAN_ORDER: SubscriptionPlan[] = ["basic", "pro", "premium"]

function AssinaturaContent() {
  const searchParams = useSearchParams()
  const paid = searchParams.get("paid") === "1"
  const cardReturn = searchParams.get("card") === "1"
  const setupCard = searchParams.get("setup") === "card"
  const showDecision = searchParams.get("decision") === "1"

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null)
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null)
  const [effectivePlan, setEffectivePlan] = useState<SubscriptionPlan | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [needsPlan, setNeedsPlan] = useState(false)
  const [needsCard, setNeedsCard] = useState(false)
  const [needsDecision, setNeedsDecision] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [billingExempt, setBillingExempt] = useState(false)
  const [trialActive, setTrialActive] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("pro")
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "PIX">("CREDIT_CARD")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const trialLengthDays = catalog?.trialDays ?? TRIAL_DAYS

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing", { credentials: "include" })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Não foi possível carregar")
        return
      }
      setSubscription(j.subscription)
      setCatalog(j.catalog)
      setEffectivePlan(j.effective_plan)
      setTrialDaysLeft(j.trial_days_left ?? 0)
      setNeedsPlan(!!j.needs_plan_choice)
      setNeedsCard(!!j.requires_card_setup)
      setNeedsDecision(!!j.needs_trial_decision)
      setCardComplete(!!j.card_setup_complete)
      setBillingEnabled(!!j.billing?.enabled)
      setBillingExempt(!!j.billing_exempt)
      setTrialActive(!!j.trial_active)
      if (j.subscription?.plan) setSelectedPlan(j.subscription.plan)
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if ((needsCard || setupCard) && !cardComplete && billingEnabled) {
      setErr(null)
    }
  }, [needsCard, setupCard, cardComplete, billingEnabled])

  useEffect(() => {
    if (!cardReturn) return
    fetch("/api/billing/confirm-card", { method: "POST", credentials: "include" })
      .then(() => load())
      .catch(() => {})
  }, [cardReturn, load])

  const handleCardFormSuccess = () => {
    setCardComplete(true)
    setNeedsCard(false)
    setMsg(null)
    setErr(null)
    void load()
  }

  const handleSubscribeEarly = async () => {
    if (
      !confirm(
        `A primeira mensalidade será cobrada já (pelo cartão já cadastrado). Os ${trialLengthDays} dias grátis deixam de se aplicar. Continuar?`
      )
    )
      return
    setCheckoutLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/subscribe-early", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao iniciar cobrança")
        return
      }
      if (j.paymentUrl) {
        window.location.href = j.paymentUrl
        return
      }
      setMsg("Cobrança acionada. Aguarde a confirmação no Asaas.")
      void load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleTrialDecision = async (action: "accept" | "decline") => {
    if (action === "decline") {
      if (!confirm("Tem certeza? Você perderá o acesso e não será cobrado.")) return
    }
    setCheckoutLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/trial-decision", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "accept" ? { action, plan: selectedPlan } : { action }
        ),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao processar")
        return
      }
      if (action === "accept" && j.paymentUrl) {
        window.location.href = j.paymentUrl
        return
      }
      if (action === "decline") {
        setMsg("Você optou por não continuar. Nenhuma cobrança foi feita.")
      } else {
        setMsg("Plano ativado. Bem-vindo!")
      }
      void load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!billingEnabled) {
      setErr("Pagamento online não está ativo. Ative a API de pagamento no Super ADM e configure ASAAS_API_KEY.")
      return
    }
    setCheckoutLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, billing_type: billingType }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao iniciar pagamento")
        return
      }
      if (j.paymentUrl) {
        window.location.href = j.paymentUrl
        return
      }
      if (j.pixCopyPaste) {
        try {
          await navigator.clipboard.writeText(j.pixCopyPaste)
          setMsg("Código PIX copiado. Cole no app do seu banco.")
        } catch {
          setMsg(`PIX: ${j.pixCopyPaste}`)
        }
      } else {
        setMsg("Assinatura criada. Aguarde a confirmação do pagamento.")
      }
      void load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleChangePlan = async (plan: SubscriptionPlan) => {
    setCheckoutLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/plan", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao alterar plano")
        return
      }
      if (j.paymentUrl) {
        window.location.href = j.paymentUrl
        return
      }
      setMsg("Plano atualizado.")
      void load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm("Cancelar assinatura? O acesso aos recursos pagos será bloqueado.")) return
    setCancelLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/cancel", { method: "POST", credentials: "include" })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao cancelar")
        return
      }
      setMsg("Assinatura cancelada.")
      void load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setCancelLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const status = subscription?.status ?? "trial"
  const nextPayment = subscription?.next_payment
    ? new Date(subscription.next_payment).toLocaleDateString("pt-BR")
    : "—"

  /** Durante o período de teste, apenas o plano Pro pode ser cobrado antecipadamente. */
  const subscribeEarlyPlans: SubscriptionPlan[] =
    trialActive && subscription?.status === "trial" ? ["pro"] : PLAN_ORDER

  const isOnboardingCheckout =
    !billingExempt && (setupCard || needsCard) && !cardComplete

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={isOnboardingCheckout ? "/cadastro" : "/painel/configuracoes?tab=plan"}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isOnboardingCheckout ? "Ative seu teste grátis" : "Minha assinatura"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnboardingCheckout
              ? `Plano Pro por ${trialLengthDays} dias — cadastre o cartão para liberar o painel.`
              : "Plano, cobrança mensal e pagamento via Asaas (cartão ou PIX)."}
          </p>
        </div>
      </div>

      {billingExempt ? (
        <div className="text-sm rounded-lg border border-border bg-muted/40 px-4 py-3">
          Conta da <strong>equipe da plataforma</strong> ou <strong>de testes</strong>: uso sem cobrança pela plataforma e sem obrigação de cartão. Barbearias
          normais seguem o período de teste no plano Pro ({trialLengthDays} dias com cartão cadastrado) e pagamento pelo Asaas.
        </div>
      ) : null}

      {paid ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          Pagamento recebido ou em processamento. O acesso será liberado em instantes.
        </div>
      ) : null}

      {cardReturn || cardComplete ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border rounded-lg p-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Cartão cadastrado. Aproveite seus {trialLengthDays} dias grátis no plano Pro — só haverá cobrança se você aceitar um plano depois.
          </div>
          {(setupCard || isOnboardingCheckout) && (
            <Button asChild className="w-full">
              <Link href="/painel">Entrar no painel</Link>
            </Button>
          )}
        </div>
      ) : null}

      {(needsCard || setupCard) && !cardComplete ? (
        billingEnabled ? (
          <Card className="border-primary shadow-md">
            <CardHeader>
              <CardTitle>Cadastre seu cartão para começar</CardTitle>
              <CardDescription>
                Último passo do cadastro. Pagamento seguro pela Asaas, direto aqui no Trim Time — sem débito
                imediato.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrialBillingTrust trialDays={trialLengthDays} />
              <TrialCardForm onSuccess={handleCardFormSuccess} onError={setErr} />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle>Cadastro de cartão</CardTitle>
              <CardDescription>
                Seu período de teste exige registrar um cartão para liberar o painel. Esta instância ainda
                não tem <strong>cobrança online ativa</strong> (configure <code className="text-xs">ASAAS_API_KEY</code> e{" "}
                <code className="text-xs">PAYMENT_API_ENABLED</code> conforme o arquivo{" "}
                <code className="text-xs">.env.example</code>).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Com o gateway ativo, o formulário de cartão aparecerá nesta página.
              </p>
              <Button className="w-full" variant="outline" disabled>
                <CreditCard className="w-4 h-4 mr-2" />
                Aguardando integração Asaas
              </Button>
            </CardContent>
          </Card>
        )
      ) : null}

      {!billingExempt &&
      !isOnboardingCheckout &&
      trialActive &&
      cardComplete &&
      billingEnabled &&
      subscription?.status === "trial" &&
      trialDaysLeft > 0 &&
      catalog ? (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardHeader>
            <CardTitle>Preferir cobrança agora?</CardTitle>
            <CardDescription>
              Durante o teste você usa o plano Pro. Você pode manter os dias grátis até o fim ou gerar já a
              primeira fatura no Asaas (somente plano Pro enquanto o período gratuito estiver ativo).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {subscribeEarlyPlans.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={selectedPlan === p ? "default" : "outline"}
                  onClick={() => setSelectedPlan(p)}
                >
                  {catalog.plans[p].name} — R$ {catalog.plans[p].price}
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              variant="secondary"
              disabled={checkoutLoading}
              onClick={() => void handleSubscribeEarly()}
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cobrar primeira mensalidade agora
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(needsDecision || showDecision) && catalog ? (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Seu teste grátis terminou</CardTitle>
            <CardDescription>
              Deseja continuar? Escolha Básico, Pro ou Premium. A cobrança só acontece se você clicar em
              &quot;Sim, quero continuar&quot;. Se recusar, não cobramos nada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrialBillingTrust trialDays={trialLengthDays} compact />
            <div className="grid gap-2">
              {PLAN_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlan(p)}
                  className={`text-left rounded-lg border p-3 ${
                    selectedPlan === p ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-medium">{catalog.plans[p].name}</span>
                  <span className="text-primary ml-2">R$ {catalog.plans[p].price}/mês</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1"
                disabled={checkoutLoading}
                onClick={() => void handleTrialDecision("accept")}
              >
                Sim, quero continuar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={checkoutLoading}
                onClick={() => void handleTrialDecision("decline")}
              >
                Não, obrigado
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {err ? (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border rounded-lg p-3">
          {msg}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo</CardTitle>
          <CardDescription>Status atual da sua conta Trim Time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
            {effectivePlan && catalog ? (
              <Badge>{catalog.plans[effectivePlan].name}</Badge>
            ) : null}
            {status === "trial" && trialDaysLeft > 0 ? (
              <span className="text-sm text-muted-foreground">
                {trialDaysLeft} dia(s) restante(s) de teste
              </span>
            ) : null}
          </div>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Valor mensal</dt>
              <dd className="font-semibold">
                {effectivePlan && catalog
                  ? `R$ ${catalog.plans[effectivePlan].price.toFixed(2)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Próxima cobrança</dt>
              <dd className="font-semibold">{nextPayment}</dd>
            </div>
            {subscription?.billing_type ? (
              <div>
                <dt className="text-muted-foreground">Forma de pagamento</dt>
                <dd className="font-semibold">
                  {subscription.billing_type === "PIX" ? "PIX" : "Cartão de crédito"}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {(needsPlan || status === "past_due" || status === "canceled") && catalog && !billingExempt ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Escolha seu plano</CardTitle>
            <CardDescription>
              {needsPlan
                ? "Seu período de teste terminou ou a assinatura precisa ser ativada."
                : "Regularize ou escolha um novo plano."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {PLAN_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlan(p)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    selectedPlan === p
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold">{catalog.plans[p].name}</span>
                    <span className="text-primary font-bold">
                      R$ {catalog.plans[p].price}/mês
                    </span>
                  </div>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    {catalog.plans[p].features.slice(0, 4).map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={billingType === "CREDIT_CARD" ? "default" : "outline"}
                size="sm"
                onClick={() => setBillingType("CREDIT_CARD")}
              >
                <CreditCard className="w-4 h-4 mr-1" />
                Cartão
              </Button>
              <Button
                type="button"
                variant={billingType === "PIX" ? "default" : "outline"}
                size="sm"
                onClick={() => setBillingType("PIX")}
              >
                <QrCode className="w-4 h-4 mr-1" />
                PIX
              </Button>
            </div>

            <Button
              className="w-full"
              onClick={() => void handleCheckout()}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Contratar plano
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Pagamento processado com segurança pelo Asaas. Não armazenamos dados do cartão.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {status === "active" && catalog ? (
        <Card>
          <CardHeader>
            <CardTitle>Alterar plano</CardTitle>
            <CardDescription>Upgrade ou downgrade — o valor é atualizado no Asaas.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {PLAN_ORDER.filter((p) => p !== subscription?.plan).map((p) => (
              <Button
                key={p}
                variant="outline"
                disabled={checkoutLoading}
                onClick={() => void handleChangePlan(p)}
              >
                {catalog.plans[p].name} — R$ {catalog.plans[p].price}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {(status === "active" || status === "past_due") && !billingExempt ? (
        <Button
          variant="destructive"
          className="w-full sm:w-auto"
          disabled={cancelLoading}
          onClick={() => void handleCancel()}
        >
          {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Cancelar assinatura
        </Button>
      ) : null}
    </div>
  )
}

export default function AssinaturaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AssinaturaContent />
    </Suspense>
  )
}
