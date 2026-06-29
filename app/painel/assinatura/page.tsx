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
import { SignupBillingFlow } from "@/components/billing/signup-billing-flow"
import { TrialCardForm } from "@/components/billing/trial-card-form"
import { PlanPicker } from "@/components/billing/plan-picker"
import { PixPaymentPanel } from "@/components/billing/pix-payment-panel"
import { TRIAL_DAYS } from "@/lib/plans"
import { formatPlanPrice, formatPlanPricePerMonth } from "@/lib/format-plan-price"

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
  const contractFromUrl = searchParams.get("contract") === "1"
  const planFromUrl = searchParams.get("plan")
  const validPlanFromUrl =
    planFromUrl && ["basic", "pro", "premium"].includes(planFromUrl)
      ? (planFromUrl as SubscriptionPlan)
      : null

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
  const [billingEnvironment, setBillingEnvironment] = useState<"sandbox" | "production" | "">("")
  const [pixEnabled, setPixEnabled] = useState(false)
  const [billingExempt, setBillingExempt] = useState(false)
  const [trialActive, setTrialActive] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(
    validPlanFromUrl ?? "pro"
  )
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "PIX">("CREDIT_CARD")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pixPending, setPixPending] = useState<{
    amount: number
    pixCopyPaste: string | null
    pixQrCode: string | null
  } | null>(null)

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
      setBillingEnvironment(
        j.billing?.environment === "production" ? "production" : "sandbox"
      )
      setPixEnabled(!!j.billing?.pix_enabled)
      setBillingExempt(!!j.billing_exempt)
      setTrialActive(!!j.trial_active)
      if (!validPlanFromUrl && j.subscription?.plan) {
        setSelectedPlan(j.subscription.plan)
      }
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [validPlanFromUrl])

  useEffect(() => {
    if (validPlanFromUrl) setSelectedPlan(validPlanFromUrl)
  }, [validPlanFromUrl])

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

  const handleCancelTrial = async () => {
    if (
      !confirm(
        `Cancelar o teste grátis? Você não será cobrado. O acesso ao painel completo será limitado após confirmar.`
      )
    )
      return
    setCancelLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/billing/cancel-trial", {
        method: "POST",
        credentials: "include",
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao cancelar teste")
        return
      }
      setMsg("Teste cancelado. Não haverá cobrança automática no seu cartão.")
      void load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setCancelLoading(false)
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
      if (action === "decline") {
        setMsg("Você optou por não continuar. Nenhuma cobrança foi feita.")
      } else {
        setMsg("Cobrança agendada no cartão cadastrado. O plano ativa após a confirmação do pagamento.")
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
    if (billingType === "CREDIT_CARD" && !cardComplete) {
      setErr("Cadastre o cartão no formulário acima antes de contratar com cartão.")
      return
    }
    setCheckoutLoading(true)
    setErr(null)
    setMsg(null)
    setPixPending(null)
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          billing_type: pixEnabled ? billingType : "CREDIT_CARD",
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao iniciar pagamento")
        return
      }
      if (billingType === "PIX" && (j.pixCopyPaste || j.pixQrCode)) {
        const amount = catalog?.plans[selectedPlan]?.price ?? 0
        setPixPending({
          amount,
          pixCopyPaste: j.pixCopyPaste ?? null,
          pixQrCode: j.pixQrCode ?? null,
        })
        setMsg("Pague o PIX abaixo. O plano ativa após a confirmação. Todo mês você receberá um novo PIX para a mensalidade.")
        void load()
        return
      }
      if (billingType === "CREDIT_CARD") {
        setMsg("Cobrança enviada ao cartão cadastrado. Aguarde a confirmação do pagamento.")
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
      setMsg("Plano atualizado. Cobrança processada no cartão cadastrado.")
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

  const isOnboardingCheckout =
    !billingExempt && (setupCard || needsCard) && !cardComplete

  const showPlanCheckout =
    !billingExempt &&
    !!catalog &&
    billingEnabled &&
    (needsPlan ||
      status === "past_due" ||
      status === "canceled" ||
      contractFromUrl ||
      (trialActive && cardComplete && subscription?.status === "trial"))

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
            {isOnboardingCheckout ? "Ative seu plano" : "Minha assinatura"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnboardingCheckout
              ? "Escolha seu plano e cadastre o cartão para liberar o painel."
              : pixEnabled
                ? "Plano mensal — cartão (débito automático) ou PIX."
                : "Plano mensal — pagamento por cartão de crédito (débito automático)."}
          </p>
          {billingEnabled && !billingExempt ? (
            <p
              className={`text-xs font-medium mt-1 ${
                billingEnvironment === "production"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {billingEnvironment === "production"
                ? "Cobrança real (Asaas produção) — o cartão será debitado de verdade."
                : "Modo teste (Asaas sandbox) — aprova no app, mas não debita no banco."}
            </p>
          ) : null}
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
            {subscription?.status === "past_due"
              ? "Cartão cadastrado. Aguardando confirmação do pagamento para liberar o plano contratado."
              : `Cartão cadastrado. Teste grátis no plano Pro por ${trialLengthDays} dias — cobrança automática após o teste, salvo se você cancelar antes.`}
          </div>
          {(setupCard || isOnboardingCheckout) && (
            <Button asChild className="w-full">
              <Link href="/painel">Entrar no painel</Link>
            </Button>
          )}
        </div>
      ) : null}

      {(needsCard || setupCard) && !cardComplete ? (
        billingEnabled && catalog ? (
          <Card className="border-primary shadow-md">
            <CardHeader>
              <CardTitle>Cadastre seu cartão para começar</CardTitle>
              <CardDescription>
                Último passo do cadastro — contrate direto ou experimente grátis por {trialLengthDays} dias.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SignupBillingFlow
                catalog={catalog}
                trialDays={trialLengthDays}
                onSuccess={handleCardFormSuccess}
                onError={setErr}
              />
            </CardContent>
          </Card>
        ) : billingEnabled ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
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
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-base">Teste grátis ativo</CardTitle>
            <CardDescription>
              Cobrança automática de {formatPlanPricePerMonth(catalog.plans.pro.price)} ({catalog.plans.pro.name}) em{" "}
              {trialDaysLeft} dia(s), se você não cancelar antes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={cancelLoading}
              onClick={() => void handleCancelTrial()}
            >
              {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cancelar teste grátis (sem cobrança)
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(needsDecision || showDecision) && catalog ? (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle>Seu teste grátis terminou</CardTitle>
            <CardDescription>
              Conta criada antes da renovação automática. Escolha um plano para continuar ou recuse — sem
              cobrança se recusar.
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
                  <span className="text-primary ml-2">{formatPlanPricePerMonth(catalog.plans[p].price)}</span>
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

      {pixPending ? (
        <PixPaymentPanel
          amount={pixPending.amount}
          pixCopyPaste={pixPending.pixCopyPaste}
          pixQrCode={pixPending.pixQrCode}
          onClose={() => setPixPending(null)}
        />
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
                  ? formatPlanPrice(catalog.plans[effectivePlan].price)
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
          {subscription?.billing_type === "PIX" && status === "active" ? (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
              Mensalidade via PIX: todo mês o Asaas envia um novo código para pagamento (pode avisar por e-mail).
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showPlanCheckout ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>
              {trialActive && subscription?.status === "trial"
                ? "Contratar um plano"
                : "Escolha seu plano"}
            </CardTitle>
            <CardDescription>
              {trialActive && subscription?.status === "trial"
                ? `Você está no teste grátis do Pro (${trialDaysLeft} dia(s) restantes). Escolha Básico, Pro ou Premium para contratar agora — o valor é do plano selecionado, não só do teste.`
                : needsPlan
                  ? "Seu período de teste terminou ou a assinatura precisa ser ativada."
                  : "Regularize ou escolha um novo plano."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Escolha o plano</p>
              <PlanPicker catalog={catalog!} value={selectedPlan} onChange={setSelectedPlan} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">2. Forma de pagamento</p>
              {pixEnabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={billingType === "CREDIT_CARD" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setBillingType("CREDIT_CARD")
                      setPixPending(null)
                    }}
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
              ) : (
                <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                  <strong className="text-foreground">Cartão de crédito</strong> — a mensalidade é cobrada
                  automaticamente todo mês no cartão cadastrado.
                </p>
              )}
            </div>

            {pixEnabled && billingType === "CREDIT_CARD" ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                <strong className="text-foreground">Cartão:</strong> a mensalidade é cobrada automaticamente todo mês no
                cartão cadastrado.
              </p>
            ) : null}

            {billingType === "CREDIT_CARD" && !cardComplete && billingEnabled ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-medium">Cadastre o cartão para contratar</p>
                <p className="text-xs text-muted-foreground">
                  Preencha os dados abaixo. Depois clique em &quot;Contratar plano&quot; para processar a cobrança.
                </p>
                <TrialCardForm
                  mode="immediate"
                  plan={selectedPlan}
                  catalog={catalog!}
                  onSuccess={handleCardFormSuccess}
                  onError={setErr}
                />
              </div>
            ) : null}

            {pixEnabled && billingType === "PIX" ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                <strong className="text-foreground">PIX:</strong> clique em <strong>Contratar plano</strong> para gerar
                o QR Code. Você paga este mês e, nos próximos, recebe um novo PIX por e-mail ou no painel (cobrança
                manual todo mês).
              </p>
            ) : null}

            <Button
              className="w-full"
              onClick={() => void handleCheckout()}
              disabled={
                checkoutLoading ||
                (billingType === "CREDIT_CARD" && !cardComplete) ||
                !billingEnabled
              }
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Contratar {catalog?.plans[selectedPlan].name ?? "plano"} —{" "}
              {formatPlanPricePerMonth(catalog?.plans[selectedPlan].price ?? 0)}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {billingEnabled
                ? pixEnabled
                  ? "Cartão: débito automático. PIX: pagamento manual todo mês."
                  : "Pagamento seguro pelo Asaas. Débito automático mensal no cartão."
                : "Cobrança online inativa — configure ASAAS_API_KEY e PAYMENT_API_ENABLED."}
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
                {catalog.plans[p].name} — {formatPlanPrice(catalog.plans[p].price)}
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
