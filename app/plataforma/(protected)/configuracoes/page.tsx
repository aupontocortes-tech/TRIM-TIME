"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import Link from "next/link"
import { ChevronDown, ChevronRight, CreditCard, Loader2, MessageCircle, Gauge } from "lucide-react"
import { ChangePasswordForm } from "@/components/account/change-password-form"
import type { SubscriptionPlan } from "@/lib/db/types"
import { PLAN_LABELS, PLAN_PRICES, TRIAL_DAYS } from "@/lib/plans"
import { formatPlanPrice } from "@/lib/format-plan-price"

const GOLD = "#D4AF37"

type SettingsPayload = {
  landing_whatsapp_phone?: string
  plan_prices?: Record<SubscriptionPlan, number>
  default_trial_days?: number
  default_trial_plan?: SubscriptionPlan
  payment_api_enabled?: boolean
  payment_api_active?: boolean
  error?: string
}

function formatPhoneSummary(digits: string) {
  const d = digits.replace(/\D/g, "")
  if (d.length < 10) return d
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length >= 12 && d.startsWith("55")) {
    const local = d.slice(2)
    if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  return d
}

function ConfigLinkCard({
  title,
  description,
  icon: Icon,
  summary,
  href,
}: {
  title: string
  description: string
  icon: typeof MessageCircle
  summary: string
  href: string
}) {
  return (
    <Card className="bg-zinc-950 border-[#D4AF37]/35 text-white overflow-hidden hover:border-[#D4AF37]/55 transition-colors">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/40"
              style={{ backgroundColor: `${GOLD}14` }}
            >
              <Icon className="w-5 h-5" style={{ color: GOLD }} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-white text-lg">{title}</CardTitle>
              <CardDescription className="text-zinc-400 mt-1">{description}</CardDescription>
              <p className="text-xs text-zinc-500 mt-2 truncate">{summary}</p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
          >
            <Link href={href}>
              Abrir
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}

function ConfigSection({
  title,
  description,
  icon: Icon,
  summary,
  open,
  onOpenChange,
  children,
}: {
  title: string
  description: string
  icon: typeof MessageCircle
  summary: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Card className="bg-zinc-950 border-[#D4AF37]/35 text-white overflow-hidden">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/40"
                style={{ backgroundColor: `${GOLD}14` }}
              >
                <Icon className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-white text-lg">{title}</CardTitle>
                <CardDescription className="text-zinc-400 mt-1">{description}</CardDescription>
                <p className="text-xs text-zinc-500 mt-2 truncate">{summary}</p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
              >
                Configurar
                <ChevronDown
                  className={`w-4 h-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 border-t border-zinc-800">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function Alert({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-md p-3"
      : "text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-md p-3"
  return <p className={cls}>{children}</p>
}

export default function PlataformaConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [waOpen, setWaOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)

  const [phone, setPhone] = useState("")
  const [savedPhone, setSavedPhone] = useState("")
  const [waSaving, setWaSaving] = useState(false)
  const [waMsg, setWaMsg] = useState<string | null>(null)
  const [waErr, setWaErr] = useState<string | null>(null)

  const [prices, setPrices] = useState({ ...PLAN_PRICES })
  const [trialDays, setTrialDays] = useState(TRIAL_DAYS)
  const [trialPlan, setTrialPlan] = useState<SubscriptionPlan>("pro")
  const [paymentApiEnabled, setPaymentApiEnabled] = useState(false)
  const [paymentApiActive, setPaymentApiActive] = useState(false)
  const [plansSaving, setPlansSaving] = useState(false)
  const [plansMsg, setPlansMsg] = useState<string | null>(null)
  const [plansErr, setPlansErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/admin/platform-settings", { credentials: "include" })
      const j = (await r.json().catch(() => ({}))) as SettingsPayload
      if (!r.ok) {
        setErr(j.error || "Não foi possível carregar")
        return
      }
      const p = j.landing_whatsapp_phone ?? ""
      setPhone(p)
      setSavedPhone(p)
      if (j.plan_prices) {
        setPrices({
          basic: j.plan_prices.basic ?? PLAN_PRICES.basic,
          pro: j.plan_prices.pro ?? PLAN_PRICES.pro,
          premium: j.plan_prices.premium ?? PLAN_PRICES.premium,
        })
      }
      if (typeof j.default_trial_days === "number") setTrialDays(j.default_trial_days)
      if (j.default_trial_plan) setTrialPlan(j.default_trial_plan)
      setPaymentApiEnabled(!!j.payment_api_enabled)
      setPaymentApiActive(!!j.payment_api_active)
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaSaving(true)
    setWaMsg(null)
    setWaErr(null)
    try {
      const r = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ landing_whatsapp_phone: phone }),
      })
      const j = (await r.json().catch(() => ({}))) as SettingsPayload
      if (!r.ok) {
        setWaErr(j.error || "Não foi possível salvar")
        return
      }
      const p = j.landing_whatsapp_phone ?? ""
      setSavedPhone(p)
      setPhone(p)
      setWaMsg("WhatsApp salvo. Os botões da página inicial foram atualizados.")
      setWaOpen(false)
    } catch {
      setWaErr("Erro de rede")
    } finally {
      setWaSaving(false)
    }
  }

  const savePlans = async (e: React.FormEvent) => {
    e.preventDefault()
    setPlansSaving(true)
    setPlansMsg(null)
    setPlansErr(null)
    try {
      const r = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          price_basic: prices.basic,
          price_pro: prices.pro,
          price_premium: prices.premium,
          default_trial_days: trialDays,
          default_trial_plan: trialPlan,
          payment_api_enabled: paymentApiEnabled,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as SettingsPayload
      if (!r.ok) {
        setPlansErr(j.error || "Não foi possível salvar")
        return
      }
      if (j.plan_prices) setPrices(j.plan_prices)
      setPaymentApiActive(!!j.payment_api_active)
      setPlansMsg("Valores dos planos salvos.")
      setPlansOpen(false)
    } catch {
      setPlansErr("Erro de rede")
    } finally {
      setPlansSaving(false)
    }
  }

  const waSummary = savedPhone.trim()
    ? `Atual: ${formatPhoneSummary(savedPhone)}`
    : "Nenhum número — botões de WhatsApp ocultos na landing"

  const plansSummary = `Trial ${trialDays}d ${PLAN_LABELS[trialPlan]} · Básico ${formatPlanPrice(prices.basic)} · Pro ${formatPlanPrice(prices.pro)} · Premium ${formatPlanPrice(prices.premium)}`

  const infraSummary = "Uso dos planos FREE — Resend, Supabase e barbearias no mês"

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações da plataforma</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Ajustes globais da landing, contato, assinaturas e monitoramento dos limites da infraestrutura.
        </p>
      </div>

      {err ? <Alert tone="err">{err}</Alert> : null}

      <div className="grid gap-6">
        <ConfigLinkCard
          title="Uso e limites (FREE)"
          description="Resend, Supabase e cadastros — semáforo verde, amarelo e vermelho."
          icon={Gauge}
          summary={infraSummary}
          href="/plataforma/configuracoes/uso-limites"
        />

        <ChangePasswordForm
          variant="platform"
          title="Senha da plataforma"
          description="Mesma conta do login em /plataforma/login. Funciona junto com Google — defina ou troque a senha aqui."
        />

        <ConfigSection
          title="Tirar dúvidas"
          description="WhatsApp dos botões “Fale conosco” e “Tirar dúvidas” na página de vendas."
          icon={MessageCircle}
          summary={waSummary}
          open={waOpen}
          onOpenChange={setWaOpen}
        >
          <form onSubmit={saveWhatsapp} className="space-y-4 pt-4">
            {waErr ? <Alert tone="err">{waErr}</Alert> : null}
            {waMsg ? <Alert tone="ok">{waMsg}</Alert> : null}
            <div>
              <Label htmlFor="wa-phone" className="text-zinc-300">
                Número do WhatsApp (com DDD)
              </Label>
              <Input
                id="wa-phone"
                type="tel"
                className="mt-1.5 bg-zinc-900 border-zinc-700 text-white"
                placeholder="11 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Deixe vazio para remover o número. Ex.: 11999998888 ou +55 11 99999-8888
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={waSaving} className="bg-[#D4AF37] text-black hover:bg-[#c9a432]">
                {waSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar WhatsApp
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-zinc-400"
                onClick={() => {
                  setPhone(savedPhone)
                  setWaErr(null)
                  setWaMsg(null)
                }}
              >
                Desfazer alterações
              </Button>
            </div>
          </form>
        </ConfigSection>

        <ConfigSection
          title="Valores dos planos"
          description="Preços exibidos na landing e no painel da barbearia (por mês)."
          icon={CreditCard}
          summary={plansSummary}
          open={plansOpen}
          onOpenChange={setPlansOpen}
        >
          <form onSubmit={savePlans} className="space-y-5 pt-4">
            {plansErr ? <Alert tone="err">{plansErr}</Alert> : null}
            {plansMsg ? <Alert tone="ok">{plansMsg}</Alert> : null}

            <div className="grid sm:grid-cols-2 gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div>
                <Label htmlFor="trial-days" className="text-zinc-300">Dias grátis no cadastro</Label>
                <Input
                  id="trial-days"
                  type="number"
                  min={0}
                  max={90}
                  className="mt-1.5 bg-zinc-950 border-zinc-700 text-white"
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="trial-plan" className="text-zinc-300">Plano do período grátis</Label>
                <select
                  id="trial-plan"
                  className="mt-1.5 w-full h-10 rounded-md bg-zinc-950 border border-zinc-700 text-white px-3 text-sm"
                  value={trialPlan}
                  onChange={(e) => setTrialPlan(e.target.value as SubscriptionPlan)}
                >
                  {(["basic", "pro", "premium"] as const).map((p) => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {(["basic", "pro", "premium"] as const).map((plan) => (
                <div key={plan} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <Label htmlFor={`price-${plan}`} className="text-zinc-300 font-medium">
                    {PLAN_LABELS[plan]}
                  </Label>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-zinc-500 text-sm">R$</span>
                    <Input
                      id={`price-${plan}`}
                      type="number"
                      min={1}
                      step={0.01}
                      className="bg-zinc-950 border-zinc-700 text-white"
                      value={prices[plan]}
                      onChange={(e) =>
                        setPrices((prev) => ({
                          ...prev,
                          [plan]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                    <span className="text-zinc-500 text-sm whitespace-nowrap">/mês</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">API de pagamento</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Ative quando ASAAS_API_KEY estiver no servidor. Cobrança recorrente via Asaas (cartão ou PIX).
                </p>
                {paymentApiActive ? (
                  <p className="text-xs text-emerald-500/90 mt-2">Status: ativa (config ou ambiente)</p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-2">Status: só exibição na landing e no painel</p>
                )}
              </div>
              <Switch
                checked={paymentApiEnabled}
                onCheckedChange={setPaymentApiEnabled}
                className="data-[state=checked]:bg-[#D4AF37]"
              />
            </div>

            <Button type="submit" disabled={plansSaving} className="bg-[#D4AF37] text-black hover:bg-[#c9a432]">
              {plansSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar valores dos planos
            </Button>
          </form>
        </ConfigSection>
      </div>
    </div>
  )
}
