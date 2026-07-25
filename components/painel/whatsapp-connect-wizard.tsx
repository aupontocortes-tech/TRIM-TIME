"use client"

import { useEffect, useState, type ReactNode } from "react"
import { GREEN_API_FIELD_COPY } from "@/lib/whatsapp-green-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CalendarCheck,
  Clock3,
  Send,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Smartphone,
  Pencil,
  Check,
  X,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Sparkles,
  MousePointerClick,
  Crown,
  Copy,
} from "lucide-react"

const STEPS = [
  { label: "Benefícios", color: "bg-emerald-500" },
  { label: "Plano", color: "bg-green-500" },
  { label: "QR Code", color: "bg-lime-500" },
  { label: "Conectar", color: "bg-teal-500" },
  { label: "Pronto", color: "bg-emerald-600" },
] as const

const BENEFITS = [
  {
    icon: CalendarCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 border-emerald-500/30",
    title: "Confirmação automática",
    desc: "Cliente agenda → recebe WhatsApp na hora.",
  },
  {
    icon: Clock3,
    color: "text-sky-400",
    bg: "bg-sky-500/15 border-sky-500/30",
    title: "Lembrete antes do horário",
    desc: "1 h, 2 h ou 1 dia antes — você escolhe.",
  },
  {
    icon: Send,
    color: "text-violet-400",
    bg: "bg-violet-500/15 border-violet-500/30",
    title: "Mensagem pós-atendimento",
    desc: "Agradeça e fidelize depois do corte.",
  },
] as const

export type WhatsAppConnectWizardProps = {
  premium: boolean
  loading: boolean
  connected: boolean
  readyToSend?: boolean
  stateLabel?: string | null
  phone: string
  shopName?: string
  shopPhone?: string
  busy: boolean
  error: string | null
  onClearError: () => void
  onSetError: (message: string) => void
  onReload: () => Promise<void>
  onScrollToSettings: () => void
  onDisconnect?: () => void
  onSaveShopPhone?: (phone: string) => Promise<void>
  idInstance?: string
  apiTokenInstance?: string
  onPhoneChange?: (value: string) => void
  onIdInstanceChange?: (value: string) => void
  onApiTokenInstanceChange?: (value: string) => void
  onSaveCredentials?: (payload: {
    phone: string
    idInstance: string
    apiTokenInstance: string
  }) => boolean | void | Promise<boolean | void>
}

function WhatsAppIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function QrIllustration() {
  return (
    <div className="relative mx-auto w-40 h-40 rounded-2xl border-2 border-dashed border-green-500/50 bg-green-500/5 overflow-hidden">
      <div className="absolute inset-3 grid grid-cols-5 grid-rows-5 gap-1 opacity-80">
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-sm ${[0, 1, 2, 4, 5, 6, 10, 14, 18, 19, 20, 22, 23, 24].includes(i) ? "bg-green-500" : "bg-green-500/20"}`}
          />
        ))}
      </div>
      <div className="wa-qr-scan-line absolute left-2 right-2 h-0.5 bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.8)]" />
    </div>
  )
}

function ClickCard({
  href,
  onClick,
  pulse = false,
  icon,
  title,
  subtitle,
  accent = "green",
}: {
  href?: string
  onClick?: () => void
  pulse?: boolean
  icon: ReactNode
  title: string
  subtitle: string
  accent?: "green" | "gold" | "sky"
}) {
  const colors = {
    green: "border-green-500/40 bg-green-500/10 hover:bg-green-500/20 hover:border-green-500/60",
    gold: "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/60",
    sky: "border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 hover:border-sky-500/60",
  }
  const inner = (
    <>
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-background/80 flex items-center justify-center">{icon}</div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-base font-semibold text-foreground flex items-center gap-2">
            {title}
            <MousePointerClick className="w-4 h-4 text-green-400 shrink-0" />
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
        </div>
        <ExternalLink className="w-5 h-5 text-green-400 shrink-0 mt-1" />
      </div>
    </>
  )
  const className = `block w-full rounded-2xl border-2 p-4 transition-all cursor-pointer ${colors[accent]} ${pulse ? "wa-pulse-cta" : ""}`
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  )
}

function StepHeader({ step }: { step: number }) {
  const current = STEPS[step - 1]
  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-20 h-20">
        <div className="absolute inset-0 rounded-3xl bg-green-500/20 wa-pulse-cta" />
        <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white wa-float-icon shadow-lg shadow-green-500/30">
          <WhatsAppIcon className="w-11 h-11" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-green-400">
          Passo {step} de {STEPS.length} · {current.label}
        </p>
        <p className="text-2xl sm:text-3xl font-bold text-foreground">WhatsApp automático</p>
      </div>
      <div className="flex justify-center gap-1.5 flex-wrap">
        {STEPS.map((s, i) => {
          const n = i + 1
          return (
            <div
              key={s.label}
              className={`h-2 rounded-full transition-all ${
                n === step ? "w-10 bg-green-500" : n < step ? "w-6 bg-green-500/60" : "w-6 bg-muted"
              }`}
              title={s.label}
            />
          )
        })}
      </div>
    </div>
  )
}

function ShopPhoneEditor({
  shopName,
  displayPhone,
  onSaveShopPhone,
  onSaved,
}: {
  shopName: string
  displayPhone: string
  onSaveShopPhone?: (phone: string) => Promise<void>
  onSaved?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayPhone)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) setDraft(displayPhone)
  }, [displayPhone, editing])

  const save = async () => {
    if (!onSaveShopPhone) return
    const trimmed = draft.trim()
    if (trimmed.replace(/\D/g, "").length < 10) {
      setLocalError("Informe um número válido com DDD.")
      return
    }
    setSaving(true)
    setLocalError(null)
    try {
      await onSaveShopPhone(trimmed)
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Não foi possível salvar o número")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white">
            <Smartphone className="w-5 h-5" />
          </div>
          <p className="text-base font-semibold text-foreground">Número da barbearia</p>
        </div>
        {!editing && onSaveShopPhone ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-1" />
            Trocar
          </Button>
        ) : null}
      </div>
      {shopName.trim() ? <p className="text-sm font-medium text-foreground">{shopName.trim()}</p> : null}
      {editing ? (
        <div className="space-y-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="(61) 99999-9999"
            className="text-lg font-semibold"
            autoFocus
          />
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-2xl font-bold text-green-400 tabular-nums">{displayPhone || "Cadastre o número"}</p>
      )}
    </section>
  )
}

function GreenApiCredentialsForm({
  phone,
  idInstance,
  apiTokenInstance,
  busy,
  onPhoneChange,
  onIdInstanceChange,
  onApiTokenInstanceChange,
  onSaveCredentials,
}: {
  phone: string
  idInstance: string
  apiTokenInstance: string
  busy: boolean
  onPhoneChange?: (value: string) => void
  onIdInstanceChange?: (value: string) => void
  onApiTokenInstanceChange?: (value: string) => void
  onSaveCredentials?: (payload: {
    phone: string
    idInstance: string
    apiTokenInstance: string
  }) => boolean | void | Promise<boolean | void>
}) {
  const [localPhone, setLocalPhone] = useState(phone)
  const [localIdInstance, setLocalIdInstance] = useState(idInstance)
  const [localToken, setLocalToken] = useState(apiTokenInstance)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => setLocalPhone(phone), [phone])
  useEffect(() => setLocalIdInstance(idInstance), [idInstance])
  useEffect(() => setLocalToken(apiTokenInstance), [apiTokenInstance])

  if (!onPhoneChange || !onIdInstanceChange || !onApiTokenInstanceChange || !onSaveCredentials) return null

  const save = async () => {
    const payload = {
      phone: localPhone.trim(),
      idInstance: localIdInstance.trim(),
      apiTokenInstance: localToken.trim(),
    }
    onPhoneChange(payload.phone)
    onIdInstanceChange(payload.idInstance)
    onApiTokenInstanceChange(payload.apiTokenInstance)
    await onSaveCredentials(payload)
  }

  return (
    <section className="w-full rounded-2xl border-2 border-teal-500/30 bg-teal-500/5 p-5 text-left space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Cole aqui (copie do console Green API)</p>
          <p className="text-xs text-muted-foreground">Os nomes são iguais aos do site — sem tradução</p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          {
            label: "Número WhatsApp",
            hint: "Com DDI 55 — ex.: 5561999999999",
            value: localPhone,
            set: (v: string) => {
              setLocalPhone(v)
              onPhoneChange(v)
            },
            placeholder: "5561999999999",
            mono: false,
            secret: false,
          },
          {
            label: GREEN_API_FIELD_COPY.idInstanceLabel,
            hint: GREEN_API_FIELD_COPY.idInstanceHint,
            value: localIdInstance,
            set: (v: string) => {
              setLocalIdInstance(v)
              onIdInstanceChange(v)
            },
            placeholder: "1101234567",
            mono: true,
            secret: false,
          },
          {
            label: GREEN_API_FIELD_COPY.apiTokenLabel,
            hint: GREEN_API_FIELD_COPY.apiTokenHint,
            value: localToken,
            set: (v: string) => {
              setLocalToken(v)
              onApiTokenInstanceChange(v)
            },
            placeholder: "d75b3a6637...",
            mono: true,
            secret: true,
          },
        ].map((field) => (
          <div key={field.label} className="rounded-xl border border-border/80 bg-background/50 p-3">
            <label className="text-sm font-bold text-green-400 font-mono">{field.label}</label>
            <Input
              type={field.secret && !showToken ? "password" : "text"}
              className={`mt-2 ${field.mono ? "font-mono text-sm" : ""}`}
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.placeholder}
              inputMode={field.label === GREEN_API_FIELD_COPY.idInstanceLabel ? "numeric" : undefined}
            />
            <p className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1">
              <Copy className="w-3 h-3 shrink-0 mt-0.5" />
              {field.hint}
            </p>
          </div>
        ))}
        {localToken ? (
          <button type="button" className="text-xs text-primary underline" onClick={() => setShowToken((v) => !v)}>
            {showToken ? "Ocultar token" : "Mostrar token"}
          </button>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white wa-pulse-cta border-0"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Salvando…" : "Salvar e ativar WhatsApp"}
          {!busy && <CheckCircle2 className="w-5 h-5 ml-2" />}
        </Button>
      </div>
    </section>
  )
}

export function WhatsAppConnectWizard(props: WhatsAppConnectWizardProps) {
  const {
    premium,
    loading,
    connected,
    readyToSend = false,
    stateLabel = null,
    phone,
    shopName = "",
    shopPhone = "",
    busy,
    error,
    onClearError,
    onSetError,
    onScrollToSettings,
    onDisconnect,
    onSaveShopPhone,
    idInstance = "",
    apiTokenInstance = "",
    onPhoneChange,
    onIdInstanceChange,
    onApiTokenInstanceChange,
    onSaveCredentials,
  } = props

  const [step, setStep] = useState(1)
  const [pickedBusiness, setPickedBusiness] = useState(false)
  const [createdInstance, setCreatedInstance] = useState(false)
  const [checkNumber, setCheckNumber] = useState(false)
  const [checkQr, setCheckQr] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [liveStateLabel, setLiveStateLabel] = useState<string | null>(stateLabel)
  const [liveReady, setLiveReady] = useState(readyToSend)

  useEffect(() => {
    setLiveStateLabel(stateLabel)
    setLiveReady(readyToSend)
  }, [stateLabel, readyToSend])

  const goTo = (n: number) => {
    setStep(n)
    onClearError()
  }

  const displayShopPhone = shopPhone.trim() || phone.trim()
  const step2Ready = pickedBusiness && createdInstance && checkNumber

  const handleCheckStatus = async () => {
    if (!premium) return
    onClearError()
    setCheckingStatus(true)
    try {
      const r = await fetch("/api/whatsapp/status", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_instance: idInstance.trim() || undefined,
          api_token_instance: apiTokenInstance.trim() || undefined,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        onSetError(typeof j.error === "string" ? j.error : "Não foi possível verificar")
        return
      }
      setLiveStateLabel(typeof j.state_label === "string" ? j.state_label : null)
      setLiveReady(j.ready_to_send === true)
      if (j.ready_to_send === true) setCheckQr(true)
    } catch {
      onSetError("Erro de rede")
    } finally {
      setCheckingStatus(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-green-500/20">
        <CardContent className="py-20 text-center">
          <div className="wa-float-icon inline-flex w-16 h-16 rounded-2xl bg-green-500/20 items-center justify-center text-green-500 mb-4">
            <WhatsAppIcon />
          </div>
          <p className="text-muted-foreground">Carregando integração…</p>
        </CardContent>
      </Card>
    )
  }

  if (connected) {
    return (
      <Card className="overflow-hidden border-2 border-green-500/30">
        <div className={`h-2 ${liveReady ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-amber-500"}`} />
        <CardContent className="pt-8 pb-8 px-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 ${
                liveReady ? "bg-green-500 text-white wa-pulse-cta" : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {liveReady ? <WhatsAppIcon className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
            </div>
            <div className="space-y-2 flex-1">
              <p className="text-2xl font-bold text-foreground">
                {liveReady ? "Tudo pronto!" : "Falta escanear o QR Code"}
              </p>
              <p className="text-green-400 font-semibold text-lg tabular-nums">{phone.trim() || "—"}</p>
              {liveStateLabel ? <p className="text-sm text-muted-foreground">{liveStateLabel}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
            {!liveReady ? (
              <>
                <ClickCard
                  href={GREEN_API_FIELD_COPY.consoleUrl}
                  pulse
                  accent="green"
                  icon={<WhatsAppIcon className="w-7 h-7 text-green-500" />}
                  title="Abrir console e escanear QR"
                  subtitle="Clique aqui → sua instância → botão QR"
                />
                <Button variant="outline" disabled={checkingStatus} onClick={() => void handleCheckStatus()}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${checkingStatus ? "animate-spin" : ""}`} />
                  Verificar status
                </Button>
              </>
            ) : (
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={onScrollToSettings}>
                <Sparkles className="w-4 h-4 mr-2" />
                Ativar lembretes e mensagens
              </Button>
            )}
            {onDisconnect ? (
              <Button variant="ghost" className="text-muted-foreground" disabled={busy} onClick={onDisconnect}>
                Desconectar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border border-green-500/20 bg-gradient-to-b from-green-500/[0.06] to-transparent">
      <CardContent className="pt-8 pb-10 px-5 sm:px-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <StepHeader step={step} />

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Seus clientes recebem mensagens no WhatsApp da barbearia — automático, sem trabalho manual.
              </p>
              <div className="grid gap-3">
                {BENEFITS.map((b) => (
                  <div key={b.title} className={`flex items-center gap-4 rounded-2xl border p-4 ${b.bg}`}>
                    <b.icon className={`w-8 h-8 shrink-0 ${b.color}`} />
                    <div className="text-left">
                      <p className="font-semibold text-foreground">{b.title}</p>
                      <p className="text-sm text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 text-left">
              <ShopPhoneEditor
                shopName={shopName}
                displayPhone={displayShopPhone}
                onSaveShopPhone={onSaveShopPhone}
                onSaved={() => setCheckNumber(false)}
              />

              <p className="text-sm font-semibold text-foreground text-center">Qual plano escolher no Green API?</p>

              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPickedBusiness(true)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    pickedBusiness
                      ? "border-green-500 bg-green-500/15 wa-pulse-cta"
                      : "border-green-500/40 bg-green-500/5 hover:border-green-500/70"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-bold uppercase text-green-400">Recomendado</span>
                  </div>
                  <p className="font-bold text-foreground">{GREEN_API_FIELD_COPY.planBusinessTitle}</p>
                  <p className="text-green-400 font-semibold">{GREEN_API_FIELD_COPY.planBusinessPrice}</p>
                  <p className="text-xs text-muted-foreground mt-2">{GREEN_API_FIELD_COPY.planBusinessDesc}</p>
                </button>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-left opacity-80">
                  <p className="font-bold text-foreground">{GREEN_API_FIELD_COPY.planDeveloperTitle}</p>
                  <p className="text-muted-foreground font-semibold">{GREEN_API_FIELD_COPY.planDeveloperPrice}</p>
                  <p className="text-xs text-amber-500/90 mt-2">{GREEN_API_FIELD_COPY.planDeveloperDesc}</p>
                </div>
              </div>

              <ClickCard
                href={GREEN_API_FIELD_COPY.consoleUrl}
                pulse={!createdInstance}
                icon={<WhatsAppIcon className="w-7 h-7 text-green-500" />}
                title="1. Clique — Create an instance (WhatsApp)"
                subtitle="Escolha WhatsApp: Business → Select. Depois copie idInstance e apiTokenInstance."
              />

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 bg-background/40">
                <Checkbox checked={createdInstance} onCheckedChange={(v) => setCreatedInstance(v === true)} />
                <span className="text-sm leading-relaxed">
                  Já criei a instância <strong className="text-green-400">WhatsApp Business</strong> no console
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border p-4 bg-background/40">
                <Checkbox checked={checkNumber} onCheckedChange={(v) => setCheckNumber(v === true)} />
                <span className="text-sm leading-relaxed">Confirmei o número da barbearia acima</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 text-left">
              <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border-2 border-green-500/30 bg-green-500/5 p-6">
                <QrIllustration />
                <div className="space-y-3 flex-1">
                  <p className="font-semibold text-foreground">Escaneie o QR Code</p>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>1. Abra o console Green API → sua instância</li>
                    <li>2. Clique em <strong className="text-foreground">QR</strong></li>
                    <li>3. No celular: WhatsApp → ⋮ → Aparelhos conectados</li>
                    <li>4. Escaneie até aparecer <strong className="text-green-400">authorized</strong></li>
                  </ol>
                </div>
              </div>

              <ClickCard
                href={GREEN_API_FIELD_COPY.consoleUrl}
                pulse
                icon={<Smartphone className="w-7 h-7 text-green-500" />}
                title="Abrir console — escanear QR agora"
                subtitle="Toque aqui. Não escolha Telegram — só WhatsApp."
              />

              {liveStateLabel ? (
                <p className="text-sm text-center text-muted-foreground">
                  Status: <strong className="text-foreground">{liveStateLabel}</strong>
                </p>
              ) : null}

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border-2 border-green-500/30 p-4">
                <Checkbox checked={checkQr} onCheckedChange={(v) => setCheckQr(v === true)} />
                <span className="text-sm">Escaneei o QR e o status está <strong className="text-green-400">authorized</strong></span>
              </label>

              <Button variant="outline" size="sm" disabled={checkingStatus} onClick={() => void handleCheckStatus()}>
                <RefreshCw className={`w-4 h-4 mr-2 ${checkingStatus ? "animate-spin" : ""}`} />
                Verificar status
              </Button>
            </div>
          )}

          {step === 4 && premium ? (
            <GreenApiCredentialsForm
              phone={phone}
              idInstance={idInstance}
              apiTokenInstance={apiTokenInstance}
              busy={busy}
              onPhoneChange={onPhoneChange}
              onIdInstanceChange={onIdInstanceChange}
              onApiTokenInstanceChange={onApiTokenInstanceChange}
              onSaveCredentials={async (payload) => {
                const ok = await onSaveCredentials?.(payload)
                if (ok === false) return
                goTo(5)
              }}
            />
          ) : step === 4 && !premium ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
              <p className="font-semibold text-foreground">Plano Premium necessário</p>
              <p className="text-sm text-muted-foreground mt-2">
                <a href="/painel/assinatura" className="text-primary underline font-medium">
                  Ative o Premium
                </a>{" "}
                para conectar o WhatsApp.
              </p>
            </div>
          ) : null}

          {step === 5 && (
            <div className="text-center space-y-4 py-4">
              <div className="wa-float-icon inline-flex w-24 h-24 rounded-full bg-green-500 items-center justify-center text-white wa-pulse-cta">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <p className="text-xl font-bold text-foreground">WhatsApp configurado!</p>
              <p className="text-muted-foreground">Agora ative os lembretes e personalize os textos abaixo.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => goTo(step - 1)} disabled={busy}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            {step === 1 && (
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white wa-pulse-cta" onClick={() => goTo(2)}>
                Começar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!step2Ready}
                onClick={() => goTo(3)}
              >
                Próximo: QR Code
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 3 && (
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white wa-pulse-cta"
                disabled={!checkQr}
                onClick={() => goTo(4)}
              >
                Próximo: colar credenciais
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 5 && (
              <Button size="lg" className="bg-green-600 text-white" onClick={onScrollToSettings}>
                Ir para lembretes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {step === 2 && !step2Ready && (
            <p className="text-center text-sm text-muted-foreground">
              Toque em <strong className="text-green-400">Business</strong> e marque os itens acima.
            </p>
          )}
          {step === 3 && !checkQr && (
            <p className="text-center text-sm text-muted-foreground">Escaneie o QR e marque a confirmação.</p>
          )}
          {error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
