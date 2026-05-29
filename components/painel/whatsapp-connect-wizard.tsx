"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  MessageSquare,
  CalendarCheck,
  Clock3,
  Send,
  Zap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Facebook,
  Settings2,
  ExternalLink,
  Smartphone,
  Phone,
} from "lucide-react"

const STEPS = ["Conheça", "Prepare-se", "Conectar", "Pronto"] as const

const REQUIRED_APPS = [
  {
    id: "wa-business",
    name: "WhatsApp Business",
    description: "Instale no celular do número da barbearia",
    color: "#25D366",
    links: [
      { label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.whatsapp.w4b" },
      { label: "App Store", href: "https://apps.apple.com/app/whatsapp-business/id1386412985" },
    ],
  },
  {
    id: "meta-business",
    name: "Meta Business Suite",
    description: "Gerencie WhatsApp e anúncios da barbearia",
    color: "#1877F2",
    links: [
      { label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.facebook.pages.app" },
      { label: "App Store", href: "https://apps.apple.com/app/meta-business-suite/id514643583" },
      { label: "Versão web", href: "https://business.facebook.com/" },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Use para entrar com sua conta Meta na conexão",
    color: "#1877F2",
    links: [
      { label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.facebook.katana" },
      { label: "App Store", href: "https://apps.apple.com/app/facebook/id284882215" },
    ],
  },
] as const

const PREP_STEPS = [
  "Baixe os apps abaixo no celular da barbearia (ou acesse a versão web da Meta).",
  "Instale o WhatsApp Business no aparelho que usa o número que você vai conectar.",
  "Confira se o número da barbearia está correto no card abaixo.",
  "Marque os três itens e clique em Continuar.",
] as const

const CONNECT_STEPS = [
  "Clique em Conectar WhatsApp — abre a tela oficial da Meta.",
  "Faça login com Facebook ou conta Meta Business.",
  "Selecione o número do WhatsApp Business da barbearia.",
  "Autorize o Trim Time — pronto, mensagens automáticas ativadas.",
] as const

export type WhatsAppConnectWizardProps = {
  premium: boolean
  loading: boolean
  connected: boolean
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
}

export function WhatsAppConnectWizard({
  premium,
  loading,
  connected,
  phone,
  shopName = "",
  shopPhone = "",
  busy,
  error,
  onClearError,
  onSetError,
  onReload,
  onScrollToSettings,
  onDisconnect,
}: WhatsAppConnectWizardProps) {
  const [step, setStep] = useState(1)
  const [checkFb, setCheckFb] = useState(false)
  const [checkWaBusiness, setCheckWaBusiness] = useState(false)
  const [checkNumber, setCheckNumber] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID?.trim()
  const metaConfigId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim()
  const metaReady = Boolean(metaAppId && metaConfigId)

  const goTo = (n: number) => {
    setStep(n)
    onClearError()
  }

  const stepReady = checkFb && checkWaBusiness && checkNumber
  const displayShopPhone = shopPhone.trim() || phone.trim()

  const handleConnectMeta = async () => {
    if (!premium) {
      onSetError("A conexão do WhatsApp está disponível no plano Premium.")
      return
    }
    if (!metaReady) {
      onSetError(
        "A conexão oficial com a Meta está sendo liberada. Você já pode configurar lembretes e textos das mensagens abaixo."
      )
      goTo(4)
      onScrollToSettings()
      return
    }

    onClearError()
    setConnecting(true)
    try {
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
        const done = () => {
          if (w.FB) resolve()
          else reject(new Error("Não foi possível carregar o login da Meta"))
        }
        if (w.FB) {
          done()
          return
        }
        w.fbAsyncInit = () => done()
        if (!document.getElementById("facebook-jssdk")) {
          const s = document.createElement("script")
          s.id = "facebook-jssdk"
          s.async = true
          s.defer = true
          s.crossOrigin = "anonymous"
          s.src = "https://connect.facebook.net/pt_BR/sdk.js"
          s.onerror = () => reject(new Error("Erro ao carregar o login da Meta"))
          document.body.appendChild(s)
        } else {
          setTimeout(done, 1500)
        }
      })

      const w = window as unknown as {
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
            if (!response.authResponse?.code) {
              reject(new Error("Conexão cancelada. Tente novamente quando quiser."))
              return
            }
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
      onSetError(e instanceof Error ? e.message : "Não foi possível conectar")
    } finally {
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">Carregando…</p>
        </CardContent>
      </Card>
    )
  }

  if (connected) {
    return (
      <Card className="bg-card border-green-500/20 overflow-hidden">
        <div className="h-1 bg-green-500" />
        <CardContent className="pt-6 pb-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-lg font-semibold text-foreground">WhatsApp conectado</p>
              <p className="text-sm text-muted-foreground">
                Número: <span className="text-foreground font-medium">{phone.trim() || "—"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Seus clientes já podem receber confirmações e lembretes automáticos.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onScrollToSettings}>
            <Settings2 className="w-4 h-4 mr-2" />
            Ajustar lembretes e mensagens
          </Button>
          {onDisconnect ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={onDisconnect}
            >
              {busy ? "…" : "Desconectar"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="pt-8 pb-10">
        <div className="text-center space-y-6 max-w-lg mx-auto">
          {/* Indicador de etapas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Passo {step} de {STEPS.length}
            </p>
            <div className="flex gap-2 justify-center">
              {STEPS.map((label, i) => {
                const n = i + 1
                return (
                  <div key={label} className="flex flex-col items-center gap-1 min-w-[4rem]">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        n < step
                          ? "bg-green-500 text-white"
                          : n === step
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {n < step ? "✓" : n}
                    </div>
                    <span className={`text-[10px] ${n === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">WhatsApp Business</p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {step === 1 && "Envie confirmações, lembretes e mensagens automáticas para seus clientes."}
                {step === 2 && "Baixe os apps, confira o número da barbearia e confirme que está pronto para conectar."}
                {step === 3 && "Conecte com a Meta em poucos cliques — login seguro, sem copiar códigos."}
                {step === 4 && "Quase lá! Ajuste lembretes e textos das mensagens na seção abaixo."}
              </p>
            </div>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 text-left max-w-sm mx-auto">
              {[
                { icon: <CalendarCheck className="w-4 h-4 text-green-500" />, text: "Confirmação de agendamento" },
                { icon: <Clock3 className="w-4 h-4 text-blue-500" />, text: "Lembretes automáticos" },
                { icon: <Send className="w-4 h-4 text-primary" />, text: "Mensagens automáticas" },
                { icon: <Zap className="w-4 h-4 text-amber-500" />, text: "Atendimento automatizado" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                  {item.icon}
                  <span className="text-xs font-medium text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="max-w-md mx-auto text-left space-y-4">
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  Número da barbearia
                </div>
                <p className="text-lg font-semibold text-foreground tracking-wide">
                  {displayShopPhone || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {shopName.trim() ? (
                    <>
                      Barbearia <strong className="text-foreground">{shopName.trim()}</strong> — use este número no
                      WhatsApp Business ao conectar.
                    </>
                  ) : (
                    "Cadastre o telefone em Configurações → Barbearia se ainda não aparecer aqui."
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Passo a passo
                </p>
                <ol className="space-y-2.5">
                  {PREP_STEPS.map((text, i) => (
                    <li key={text} className="flex gap-3 text-xs text-muted-foreground leading-relaxed">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-2.5">
                <p className="text-sm font-medium text-foreground">Apps que você vai usar</p>
                {REQUIRED_APPS.map((app) => (
                  <div key={app.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ backgroundColor: app.color }}
                      >
                        {app.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{app.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-12">
                      {app.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-muted/50 transition-colors"
                        >
                          {link.label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-sm font-medium text-foreground">Confirme que está pronto</p>
                {[
                  { checked: checkFb, set: setCheckFb, text: "Tenho conta Facebook ou Meta" },
                  { checked: checkWaBusiness, set: setCheckWaBusiness, text: "Meu número está no WhatsApp Business" },
                  { checked: checkNumber, set: setCheckNumber, text: "Confirmei que é o número da barbearia acima" },
                ].map((item) => (
                  <label
                    key={item.text}
                    className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <Checkbox checked={item.checked} onCheckedChange={(v) => item.set(v === true)} className="mt-0.5" />
                    <span className="text-sm text-foreground">{item.text}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-md mx-auto space-y-4 text-left">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1877F2]/15 flex items-center justify-center">
                    <Facebook className="w-5 h-5 text-[#1877F2]" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Login oficial da Meta</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao clicar, abre a janela da Meta para autorizar o número{" "}
                  {displayShopPhone ? (
                    <strong className="text-foreground">{displayShopPhone}</strong>
                  ) : (
                    "da barbearia"
                  )}
                  . Sem token manual, sem complicação.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">O que vai acontecer</p>
                <ol className="space-y-2.5">
                  {CONNECT_STEPS.map((text, i) => (
                    <li key={text} className="flex gap-3 text-xs text-muted-foreground leading-relaxed">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-[10px] font-bold text-green-600 dark:text-green-400">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-sm mx-auto rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-left">
              <p className="text-sm text-foreground">
                Use a seção <strong>Lembretes automáticos</strong> e <strong>Textos das mensagens</strong> abaixo para
                personalizar o que seus clientes recebem.
              </p>
            </div>
          )}

          {/* Botões — sempre visíveis por etapa */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {step > 1 && step <= 4 && (
              <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={busy || connecting}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}

            {step === 1 && (
              <Button type="button" size="lg" className="bg-green-600 hover:bg-green-700 text-white px-10" onClick={() => goTo(2)}>
                Começar configuração
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {step === 2 && (
              <Button
                type="button"
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-10"
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
                className="bg-green-600 hover:bg-green-700 text-white px-10"
                disabled={busy || connecting}
                onClick={() => void handleConnectMeta()}
              >
                {connecting ? "Conectando…" : "Conectar WhatsApp"}
                {!connecting && <Zap className="w-4 h-4 ml-2" />}
              </Button>
            )}

            {step === 4 && (
              <Button type="button" size="lg" className="bg-primary text-primary-foreground px-10" onClick={onScrollToSettings}>
                <Settings2 className="w-4 h-4 mr-2" />
                Ir para configurações
              </Button>
            )}
          </div>

          {step === 2 && !stepReady && (
            <p className="text-xs text-muted-foreground">Marque os três itens para continuar.</p>
          )}

          {!premium && step >= 3 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 max-w-sm mx-auto text-left">
              <p className="text-sm font-medium text-foreground">Plano Premium</p>
              <p className="text-xs text-muted-foreground mt-1">
                A conexão do WhatsApp exige Premium.{" "}
                <a href="/painel/assinatura" className="text-primary underline">
                  Ver planos
                </a>
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm max-w-sm mx-auto text-left">
              {error}
            </div>
          )}

          {error && error.includes("Meta") && step === 3 && (
            <Button type="button" variant="link" className="text-primary" onClick={() => { goTo(4); onScrollToSettings() }}>
              Continuar e configurar mensagens abaixo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
