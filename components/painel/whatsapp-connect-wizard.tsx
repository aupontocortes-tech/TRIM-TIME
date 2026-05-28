"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  MessageSquare,
  CalendarCheck,
  Clock3,
  Send,
  Zap,
  Shield,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Facebook,
} from "lucide-react"

const WIZARD_STORAGE_KEY = "trimtime_wa_wizard_step"
const TOTAL_STEPS = 5

const STEP_LABELS = [
  "Conheça",
  "Prepare-se",
  "Conectar",
  "Lembretes",
  "Pronto",
] as const

type WizardStep = 1 | 2 | 3 | 4 | 5

function loadSavedStep(): WizardStep {
  if (typeof window === "undefined") return 1
  const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY)
  const n = raw ? Number(raw) : 1
  if (n >= 1 && n <= 5) return n as WizardStep
  return 1
}

function saveStep(step: WizardStep) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(WIZARD_STORAGE_KEY, String(step))
}

export type WhatsAppConnectWizardProps = {
  premium: boolean
  loading: boolean
  connected: boolean
  phone: string
  busy: boolean
  error: string | null
  onClearError: () => void
  onSetError: (message: string) => void
  onReload: () => Promise<void>
  /** Ativa lembretes e salva (etapa 4). */
  notifWa: boolean
  onNotifWaChange: (v: boolean) => void
  onSaveNotifications: () => Promise<boolean>
  notifBusy: boolean
}

export function WhatsAppConnectWizard({
  premium,
  loading,
  connected,
  phone,
  busy,
  error,
  onClearError,
  onSetError,
  onReload,
  notifWa,
  onNotifWaChange,
  onSaveNotifications,
  notifBusy,
}: WhatsAppConnectWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [checkFb, setCheckFb] = useState(false)
  const [checkWaBusiness, setCheckWaBusiness] = useState(false)
  const [checkNumber, setCheckNumber] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID?.trim()
  const metaConfigId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim()
  const metaReady = Boolean(metaAppId && metaConfigId)

  const goTo = useCallback((s: WizardStep) => {
    setStep(s)
    saveStep(s)
    onClearError()
  }, [onClearError])

  useEffect(() => {
    if (loading) return
    if (connected) {
      setStep(5)
      saveStep(5)
      return
    }
    const saved = loadSavedStep()
    if (saved > 1 && saved < 5) setStep(saved)
  }, [loading, connected])

  const handleConnectMeta = async () => {
    if (!metaReady) return
    onClearError()
    setConnecting(true)

    try {
      // Carrega SDK da Meta sob demanda
      await new Promise<void>((resolve, reject) => {
        if (typeof window === "undefined") {
          reject(new Error("Ambiente inválido"))
          return
        }
        const w = window as Window & {
          FB?: {
            init: (p: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void
            login: (
              cb: (r: { authResponse?: { code?: string } }) => void,
              opts: Record<string, string | boolean>
            ) => void
          }
          fbAsyncInit?: () => void
        }
        if (w.FB) {
          resolve()
          return
        }
        w.fbAsyncInit = () => resolve()
        const existing = document.getElementById("facebook-jssdk")
        if (existing) {
          const t = setInterval(() => {
            if (w.FB) {
              clearInterval(t)
              resolve()
            }
          }, 100)
          setTimeout(() => {
            clearInterval(t)
            if (!w.FB) reject(new Error("Não foi possível carregar o login da Meta"))
          }, 8000)
          return
        }
        const s = document.createElement("script")
        s.id = "facebook-jssdk"
        s.async = true
        s.defer = true
        s.crossOrigin = "anonymous"
        s.src = "https://connect.facebook.net/pt_BR/sdk.js"
        s.onerror = () => reject(new Error("Erro ao carregar o login da Meta"))
        document.body.appendChild(s)
      })

      const w = window as Window & {
        FB: {
          init: (p: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void
          login: (
            cb: (r: { authResponse?: { code?: string } }) => void,
            opts: Record<string, string | boolean>
          ) => void
        }
      }

      w.FB.init({
        appId: metaAppId!,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      })

      await new Promise<void>((resolve, reject) => {
        w.FB.login(
          (response) => {
            if (response.authResponse?.code) {
              void fetch("/api/whatsapp/meta-signup", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: response.authResponse.code }),
              })
                .then(async (r) => {
                  const j = await r.json().catch(() => ({}))
                  if (!r.ok) {
                    reject(new Error(typeof j.error === "string" ? j.error : "Não foi possível conectar"))
                    return
                  }
                  await onReload()
                  resolve()
                })
                .catch(() => reject(new Error("Erro de rede ao conectar")))
            } else {
              reject(new Error("Conexão cancelada ou não autorizada"))
            }
          },
          {
            config_id: metaConfigId!,
            response_type: "code",
            override_default_response_type: true,
            extras: JSON.stringify({ setup: {} }),
          }
        )
      })

      goTo(4)
    } catch (e) {
      onSetError(e instanceof Error ? e.message : "Não foi possível conectar com a Meta")
    } finally {
      setConnecting(false)
    }
  }

  const stepReady = checkFb && checkWaBusiness && checkNumber

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </CardContent>
      </Card>
    )
  }

  if (connected && step === 5) {
    return (
      <Card className="bg-card border-green-500/20 overflow-hidden">
        <div className="h-1 bg-green-500" />
        <CardContent className="pt-6 pb-6">
          <WizardProgress current={5} />
          <div className="flex items-start gap-4 mt-6">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-lg font-semibold text-foreground">Tudo configurado!</p>
              <p className="text-sm text-muted-foreground">
                WhatsApp conectado: <span className="text-foreground font-medium">{phone.trim() || "—"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Seus clientes já podem receber confirmações e lembretes automáticos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            <Button type="button" variant="outline" size="sm" onClick={() => goTo(4)}>
              Ajustar lembretes
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="pt-8 pb-10">
        <div className="text-center space-y-6 max-w-lg mx-auto">
          <WizardProgress current={step} />

          {/* Cabeçalho fixo em todas as etapas */}
          <div className="space-y-4 pt-2">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">WhatsApp Business</p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {step === 1 && "Conecte seu WhatsApp oficial em poucos passos. Vamos guiar você."}
                {step === 2 && "Confirme que você tem tudo pronto antes de conectar."}
                {step === 3 && "Autorize com sua conta Meta (Facebook) — é rápido e seguro."}
                {step === 4 && "Ative os lembretes para seus clientes não esquecerem o horário."}
                {step === 5 && "Parabéns! Sua barbearia está pronta para enviar mensagens automáticas."}
              </p>
            </div>
          </div>

          {/* Conteúdo da etapa */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 text-left max-w-sm mx-auto">
              {[
                { icon: <CalendarCheck className="w-4 h-4 text-green-500" />, text: "Confirmação de agendamento" },
                { icon: <Clock3 className="w-4 h-4 text-blue-500" />, text: "Lembretes automáticos" },
                { icon: <Send className="w-4 h-4 text-primary" />, text: "Mensagens automáticas" },
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: "Atendimento automatizado" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5"
                >
                  {item.icon}
                  <span className="text-xs font-medium text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="max-w-sm mx-auto text-left space-y-3">
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox checked={checkFb} onCheckedChange={(v) => setCheckFb(v === true)} className="mt-0.5" />
                <span className="text-sm text-foreground">
                  Tenho uma conta <strong>Facebook ou Meta</strong> (pessoal ou da empresa)
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox
                  checked={checkWaBusiness}
                  onCheckedChange={(v) => setCheckWaBusiness(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground">
                  Meu número já está no <strong>WhatsApp Business</strong> (app no celular)
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox checked={checkNumber} onCheckedChange={(v) => setCheckNumber(v === true)} className="mt-0.5" />
                <span className="text-sm text-foreground">
                  Sei qual é o <strong>número da barbearia</strong> que quero usar para os clientes
                </span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1877F2]/15 flex items-center justify-center">
                    <Facebook className="w-5 h-5 text-[#1877F2]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Login oficial da Meta</p>
                    <p className="text-xs text-muted-foreground">Você escolhe o número e autoriza em uma janela segura.</p>
                  </div>
                </div>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Clique em &quot;Conectar com a Meta&quot;</li>
                  <li>Entre com Facebook ou Instagram Business</li>
                  <li>Selecione ou crie sua conta WhatsApp Business</li>
                  <li>Confirme o número — pronto!</li>
                </ol>
              </div>
              {!metaReady && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    A conexão automática com a Meta está sendo ativada na plataforma. Em breve este botão abrirá o
                    cadastro oficial.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="max-w-sm mx-auto text-left space-y-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Switch checked={notifWa} onCheckedChange={onNotifWaChange} id="wizard-notif-wa" />
                <label htmlFor="wizard-notif-wa" className="text-sm font-medium text-foreground cursor-pointer">
                  Enviar lembretes por WhatsApp antes do horário
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendado: o cliente recebe um aviso 1 ou 2 horas antes. Você pode personalizar os textos na seção
                abaixo depois.
              </p>
            </div>
          )}

          {/* Premium gate */}
          {!premium ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3 max-w-sm mx-auto">
              <p className="text-sm font-semibold text-foreground">Disponível no plano Premium</p>
              <p className="text-xs text-muted-foreground">
                Faça upgrade para desbloquear o WhatsApp automático.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => (window.location.href = "/painel/assinatura")}>
                Ver planos
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              {step > 1 && step < 5 && (
                <Button type="button" variant="outline" onClick={() => goTo((step - 1) as WizardStep)} disabled={busy || connecting}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
              )}

              {step === 1 && (
                <Button
                  type="button"
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  onClick={() => goTo(2)}
                >
                  Começar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  type="button"
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  disabled={!stepReady}
                  onClick={() => goTo(3)}
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {step === 3 && (
                <Button
                  type="button"
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  disabled={!metaReady || busy || connecting}
                  onClick={() => void handleConnectMeta()}
                >
                  {connecting ? "Conectando…" : "Conectar com a Meta"}
                  {!connecting && <Zap className="w-4 h-4 ml-2" />}
                </Button>
              )}

              {step === 4 && (
                <Button
                  type="button"
                  size="lg"
                  className="bg-primary text-primary-foreground px-8"
                  disabled={notifBusy}
                  onClick={async () => {
                    onNotifWaChange(true)
                    const ok = await onSaveNotifications()
                    if (ok) goTo(5)
                  }}
                >
                  {notifBusy ? "Salvando…" : "Salvar e concluir"}
                  <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}

          {error ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm max-w-sm mx-auto">
              {error}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function WizardProgress({ current }: { current: number }) {
  return (
    <div className="space-y-3 max-w-md mx-auto">
      <p className="text-xs font-medium text-muted-foreground">
        Etapa {current} de {TOTAL_STEPS}
      </p>
      <div className="flex gap-1">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1
          const done = n < current
          const active = n === current
          return (
            <div key={label} className="flex-1 space-y-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  done ? "bg-green-500" : active ? "bg-primary" : "bg-muted"
                }`}
              />
              <p
                className={`text-[10px] leading-tight truncate ${
                  active ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
