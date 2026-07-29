"use client"

import { useEffect, useState, type ReactNode } from "react"
import { GREEN_API_FIELD_COPY } from "@/lib/whatsapp-green-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CalendarCheck,
  Clock3,
  Send,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Sparkles,
  MousePointerClick,
  Unplug,
  Phone,
} from "lucide-react"

const CONNECT_GUIDE_STEPS = [
  "Crie conta no Green API e clique em Create instance",
  "Instale o WhatsApp no celular da barbearia e ative o chip",
  "No Green API: Link with QR code → escaneie no WhatsApp (Aparelhos conectados)",
  "Espere status authorized (verde) → copie os 3 dados abaixo → Salvar",
] as const

function ConnectGuideBox() {
  return (
    <section className="rounded-2xl border-2 border-green-500/40 bg-green-500/10 p-4 space-y-3">
      <p className="text-sm font-bold text-foreground">Como conectar — 4 passos</p>
      <ol className="space-y-2">
        {CONNECT_GUIDE_STEPS.map((text, i) => (
          <li key={text} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="text-muted-foreground leading-snug pt-0.5">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const STEPS = [
  { label: "Benefícios", color: "bg-emerald-500" },
  { label: "Conectar", color: "bg-green-500" },
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
  onDisconnect?: () => void | Promise<void>
  /** Após desconectar, abre direto o passo de colar credenciais. */
  startAtConnectStep?: boolean
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
    greenApiBaseUrl?: string
  }) => boolean | void | Promise<boolean | void>
  greenApiBaseUrl?: string
  onGreenApiBaseUrlChange?: (value: string) => void
}

function WhatsAppIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
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

function GreenApiCredentialsForm({
  phone,
  idInstance,
  apiTokenInstance,
  greenApiBaseUrl = "",
  busy,
  onPhoneChange,
  onIdInstanceChange,
  onApiTokenInstanceChange,
  onGreenApiBaseUrlChange,
  onSaveCredentials,
}: {
  phone: string
  idInstance: string
  apiTokenInstance: string
  greenApiBaseUrl?: string
  busy: boolean
  onPhoneChange?: (value: string) => void
  onIdInstanceChange?: (value: string) => void
  onApiTokenInstanceChange?: (value: string) => void
  onGreenApiBaseUrlChange?: (value: string) => void
  onSaveCredentials?: (payload: {
    phone: string
    idInstance: string
    apiTokenInstance: string
    greenApiBaseUrl?: string
  }) => boolean | void | Promise<boolean | void>
}) {
  const [localPhone, setLocalPhone] = useState(phone)
  const [localIdInstance, setLocalIdInstance] = useState(idInstance)
  const [localToken, setLocalToken] = useState(apiTokenInstance)
  const [localBaseUrl, setLocalBaseUrl] = useState(greenApiBaseUrl)
  const [showToken, setShowToken] = useState(false)
  const [showOptionalApiUrl, setShowOptionalApiUrl] = useState(Boolean(greenApiBaseUrl.trim()))

  useEffect(() => setLocalPhone(phone), [phone])
  useEffect(() => setLocalIdInstance(idInstance), [idInstance])
  useEffect(() => setLocalToken(apiTokenInstance), [apiTokenInstance])
  useEffect(() => setLocalBaseUrl(greenApiBaseUrl), [greenApiBaseUrl])

  if (!onPhoneChange || !onIdInstanceChange || !onApiTokenInstanceChange || !onSaveCredentials) return null

  const save = async () => {
    const payload = {
      phone: localPhone.trim(),
      idInstance: localIdInstance.trim(),
      apiTokenInstance: localToken.trim(),
      greenApiBaseUrl: localBaseUrl.trim() || undefined,
    }
    onPhoneChange(payload.phone)
    onIdInstanceChange(payload.idInstance)
    onApiTokenInstanceChange(payload.apiTokenInstance)
    onGreenApiBaseUrlChange?.(localBaseUrl.trim())
    await onSaveCredentials(payload)
  }

  const requiredFields = [
    {
      step: 1,
      label: "Número WhatsApp",
      short: "Número do chip (55 + DDD + celular, só dígitos)",
      value: localPhone,
      set: (v: string) => {
        setLocalPhone(v)
        onPhoneChange(v)
      },
      placeholder: "5561999999999",
      mono: false,
      secret: false,
      inputMode: "numeric" as const,
      done: localPhone.trim().length >= 10,
    },
    {
      step: 2,
      label: GREEN_API_FIELD_COPY.idInstanceLabel,
      short: "Copie do Green API — número da instância",
      value: localIdInstance,
      set: (v: string) => {
        setLocalIdInstance(v)
        onIdInstanceChange(v)
      },
      placeholder: "1101234567",
      mono: true,
      secret: false,
      inputMode: "numeric" as const,
      done: localIdInstance.trim().length > 0,
    },
    {
      step: 3,
      label: GREEN_API_FIELD_COPY.apiTokenLabel,
      short: "Copie da mesma tela — token secreto",
      value: localToken,
      set: (v: string) => {
        setLocalToken(v)
        onApiTokenInstanceChange(v)
      },
      placeholder: "d75b3a6637...",
      mono: true,
      secret: true,
      inputMode: undefined,
      done: localToken.trim().length > 0,
    },
  ] as const

  const filledCount = requiredFields.filter((f) => f.done).length

  const canSave =
    localPhone.trim().length >= 10 &&
    localIdInstance.trim().length > 0 &&
    localToken.trim().length > 0

  return (
    <section className="w-full rounded-2xl border-2 border-green-500/50 bg-green-500/[0.07] p-5 text-left space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-green-400">Obrigatório</p>
        <p className="text-lg font-bold text-foreground">Cole os 3 dados aqui</p>
        <p className="text-sm text-muted-foreground">
          Só depois do QR escaneado e status <strong className="text-foreground">authorized</strong> no Green API.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 text-xs">
        <span className="font-semibold text-foreground">{filledCount}/3</span>
        <span className="text-muted-foreground">campos preenchidos</span>
        {canSave ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto shrink-0" aria-hidden />
        ) : null}
      </div>

      <div className="space-y-3">
        {requiredFields.map((field) => (
          <div
            key={field.label}
            className={`rounded-xl border-2 p-3 shadow-sm transition-colors ${
              field.done
                ? "border-green-500/50 bg-green-500/5"
                : "border-green-500/30 bg-background/70"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">
                {field.step}
              </span>
              <label htmlFor={`wa-field-${field.step}`} className="text-base font-bold text-foreground font-mono">
                {field.label}
              </label>
              {field.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-label="Preenchido" />
              ) : null}
            </div>
            <p className="text-sm text-green-400/90 mb-2 pl-9">{field.short}</p>
            <Input
              id={`wa-field-${field.step}`}
              type={field.secret && !showToken ? "password" : "text"}
              className={`${field.mono ? "font-mono text-sm" : ""} border-green-500/20 focus-visible:ring-green-500/40`}
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.placeholder}
              inputMode={field.inputMode}
              aria-required
            />
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-background/30 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowOptionalApiUrl((v) => !v)}
          >
            <span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mr-2">
                Opcional
              </span>
              {GREEN_API_FIELD_COPY.apiUrlLabel} — pode deixar em branco
            </span>
            <span className="text-xs shrink-0">{showOptionalApiUrl ? "Ocultar" : "Mostrar"}</span>
          </button>
          {showOptionalApiUrl ? (
            <div className="mt-3 pt-3 border-t border-border/60">
              <label className="text-sm font-bold text-muted-foreground font-mono">{GREEN_API_FIELD_COPY.apiUrlLabel}</label>
              <Input
                type="text"
                className="mt-2 font-mono text-sm"
                value={localBaseUrl}
                onChange={(e) => {
                  setLocalBaseUrl(e.target.value)
                  onGreenApiBaseUrlChange?.(e.target.value)
                }}
                placeholder="https://7107.api.greenapi.com"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Só preencha se o salvamento falhar. Na maioria dos casos detectamos sozinhos.
              </p>
            </div>
          ) : null}
        </div>

        {localToken ? (
          <button type="button" className="text-xs text-primary underline" onClick={() => setShowToken((v) => !v)}>
            {showToken ? "Ocultar token" : "Mostrar token"}
          </button>
        ) : null}
        {!canSave && !busy ? (
          <p className="text-sm text-center text-muted-foreground">
            Falta preencher {3 - filledCount} campo{3 - filledCount === 1 ? "" : "s"}.
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white wa-pulse-cta border-0"
          disabled={busy || !canSave}
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
    startAtConnectStep = false,
    onSaveShopPhone,
    idInstance = "",
    apiTokenInstance = "",
    greenApiBaseUrl = "",
    onPhoneChange,
    onIdInstanceChange,
    onApiTokenInstanceChange,
    onGreenApiBaseUrlChange,
    onSaveCredentials,
  } = props

  const [step, setStep] = useState(startAtConnectStep ? 2 : 1)
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
          </div>

          {onDisconnect ? (
            <section className="rounded-2xl border-2 border-amber-500/35 bg-amber-500/5 p-5 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-amber-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Quer usar outro número?</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Desconecte aqui, escaneie o QR no Green API com o novo WhatsApp e cole as credenciais de novo.
                  </p>
                </div>
              </div>
              <ol className="text-sm text-muted-foreground space-y-1.5 pl-1">
                <li>1. Clique em <strong className="text-foreground">Desconectar e trocar número</strong></li>
                <li>2. No Green API: QR com o novo celular (ou nova instância)</li>
                <li>3. Cole idInstance, token e o novo número → Salvar</li>
              </ol>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-amber-500/50 text-amber-100 hover:bg-amber-500/15 hover:text-foreground"
                disabled={busy}
                onClick={() => void onDisconnect()}
              >
                <Unplug className="w-4 h-4 mr-2" />
                {busy ? "Desconectando…" : "Desconectar e trocar número"}
              </Button>
            </section>
          ) : null}
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

          {step === 2 && premium ? (
            <div className="space-y-5 text-left">
              <ConnectGuideBox />

              <ClickCard
                href={GREEN_API_FIELD_COPY.consoleUrl}
                pulse
                icon={<WhatsAppIcon className="w-7 h-7 text-green-500" />}
                title="Abrir Green API"
                subtitle="Passo 1–3: crie instância, escaneie QR, espere authorized"
              />

              <GreenApiCredentialsForm
                phone={phone}
                idInstance={idInstance}
                apiTokenInstance={apiTokenInstance}
                greenApiBaseUrl={greenApiBaseUrl}
                busy={busy}
                onPhoneChange={onPhoneChange}
                onIdInstanceChange={onIdInstanceChange}
                onApiTokenInstanceChange={onApiTokenInstanceChange}
                onGreenApiBaseUrlChange={onGreenApiBaseUrlChange}
                onSaveCredentials={async (payload) => {
                  const ok = await onSaveCredentials?.(payload)
                  if (ok === false) return
                  goTo(3)
                }}
              />

              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Já escaneou o QR?</p>
                <p className="text-xs text-muted-foreground">
                  WhatsApp → Aparelhos conectados. Status precisa estar <strong className="text-green-400">authorized</strong>.
                </p>
                {liveStateLabel ? (
                  <p className="text-sm text-muted-foreground">
                    Status: <strong className="text-foreground">{liveStateLabel}</strong>
                  </p>
                ) : null}
                <Button variant="outline" size="sm" disabled={checkingStatus} onClick={() => void handleCheckStatus()}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${checkingStatus ? "animate-spin" : ""}`} />
                  Verificar status
                </Button>
              </div>
            </div>
          ) : step === 2 && !premium ? (
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

          {step === 3 && (
            <div className="text-center space-y-4 py-4">
              <div className="wa-float-icon inline-flex w-24 h-24 rounded-full bg-green-500 items-center justify-center text-white wa-pulse-cta">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <p className="text-xl font-bold text-foreground">WhatsApp configurado!</p>
              <p className="text-muted-foreground">Ative os lembretes e personalize os textos abaixo.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {step > 1 && step < 3 && (
              <Button variant="outline" onClick={() => goTo(step - 1)} disabled={busy}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            {step === 1 && (
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white wa-pulse-cta" onClick={() => goTo(2)}>
                Conectar WhatsApp
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 3 && (
              <Button size="lg" className="bg-green-600 text-white" onClick={onScrollToSettings}>
                Ir para lembretes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
