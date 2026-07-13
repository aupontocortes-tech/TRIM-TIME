"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Pencil,
  Check,
  X,
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
  "Confira se o número da barbearia está correto (toque em Trocar se precisar).",
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
  /** Salva o telefone da barbearia (WhatsApp) sem sair desta tela. */
  onSaveShopPhone?: (phone: string) => Promise<void>
  /** Credenciais manuais da Meta Cloud API (Phone Number ID + token). */
  graphPhoneId?: string
  accessToken?: string
  onPhoneChange?: (value: string) => void
  onGraphPhoneIdChange?: (value: string) => void
  onAccessTokenChange?: (value: string) => void
  onSaveCredentials?: () => void | Promise<void>
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

  const startEdit = () => {
    setDraft(displayPhone)
    setLocalError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(displayPhone)
    setLocalError(null)
    setEditing(false)
  }

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
    <section className="rounded-xl border border-primary/25 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            1
          </span>
          <p className="text-base font-semibold text-foreground">Número da barbearia</p>
        </div>
        {!editing && onSaveShopPhone ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            onClick={startEdit}
            title="Trocar número"
            aria-label="Trocar número da barbearia"
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            Trocar
          </Button>
        ) : null}
      </div>
      {shopName.trim() ? <p className="text-base text-foreground font-medium pl-9">{shopName.trim()}</p> : null}
      {editing ? (
        <div className="pl-9 space-y-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="(61) 99999-9999"
            className="bg-input border-border text-foreground text-lg font-semibold"
            autoFocus
          />
          <p className="text-sm text-muted-foreground">
            Use o número que vai conectar no WhatsApp Business (de preferência um que não esteja no WhatsApp comum).
          </p>
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              <Check className="w-4 h-4 mr-1" />
              {saving ? "Salvando…" : "Salvar número"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={cancelEdit}>
              <X className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xl font-bold text-foreground tracking-wide pl-9">{displayPhone || "—"}</p>
          <p className="text-base text-muted-foreground leading-relaxed pl-9">
            {shopName.trim()
              ? "Use este número no WhatsApp Business ao conectar. Toque em Trocar se for outro celular."
              : "Cadastre o telefone aqui ou toque em Trocar."}
          </p>
        </>
      )}
    </section>
  )
}

function MetaCredentialsForm({
  phone,
  graphPhoneId,
  accessToken,
  busy,
  onPhoneChange,
  onGraphPhoneIdChange,
  onAccessTokenChange,
  onSaveCredentials,
}: {
  phone: string
  graphPhoneId: string
  accessToken: string
  busy: boolean
  onPhoneChange?: (value: string) => void
  onGraphPhoneIdChange?: (value: string) => void
  onAccessTokenChange?: (value: string) => void
  onSaveCredentials?: () => void | Promise<void>
}) {
  if (!onPhoneChange || !onGraphPhoneIdChange || !onAccessTokenChange || !onSaveCredentials) {
    return null
  }
  return (
    <section className="w-full rounded-xl border border-primary/30 bg-primary/5 p-5 text-left space-y-4">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Colar dados da Meta (teste)</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Na Meta: WhatsApp → Etapa 1 → copie <strong className="text-foreground">Phone Number ID</strong> e{" "}
          <strong className="text-foreground">Token</strong> e cole aqui.
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Número WhatsApp (exibição)</label>
          <Input
            className="mt-1 bg-input border-border text-foreground"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="5561993465193"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Phone Number ID</label>
          <Input
            className="mt-1 bg-input border-border text-foreground font-mono text-sm"
            value={graphPhoneId}
            onChange={(e) => onGraphPhoneIdChange(e.target.value)}
            placeholder="1260723217113545"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Token de acesso</label>
          <Input
            type="password"
            className="mt-1 bg-input border-border text-foreground font-mono text-sm"
            value={accessToken}
            onChange={(e) => onAccessTokenChange(e.target.value)}
            placeholder="EAA..."
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          className="bg-primary text-primary-foreground w-full sm:w-auto"
          disabled={busy}
          onClick={() => void onSaveCredentials()}
        >
          {busy ? "Salvando…" : "Salvar Phone Number ID e token"}
        </Button>
      </div>
    </section>
  )
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
  onSaveShopPhone,
  graphPhoneId = "",
  accessToken = "",
  onPhoneChange,
  onGraphPhoneIdChange,
  onAccessTokenChange,
  onSaveCredentials,
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
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-base md:text-lg">Carregando…</p>
        </CardContent>
      </Card>
    )
  }

  if (connected) {
    return (
      <Card className="bg-card border-green-500/20 overflow-hidden">
        <div className="h-1.5 bg-green-500" />
        <CardContent className="pt-8 pb-8 px-6 md:px-10 space-y-5">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xl md:text-2xl font-semibold text-foreground">WhatsApp conectado</p>
              <p className="text-base md:text-lg text-muted-foreground">
                Número: <span className="text-foreground font-semibold">{phone.trim() || "—"}</span>
              </p>
              <p className="text-sm md:text-base text-muted-foreground">
                Seus clientes já podem receber confirmações e lembretes automáticos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={onScrollToSettings}>
              <Settings2 className="w-5 h-5 mr-2" />
              Ajustar lembretes e mensagens
            </Button>
            {onDisconnect ? (
              <Button
                type="button"
                variant="outline"
                className="text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={onDisconnect}
              >
                {busy ? "…" : "Desconectar"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="pt-8 pb-10 px-5 sm:px-8 md:px-10">
        <div className="text-center space-y-7 w-full max-w-3xl mx-auto">
          {/* Indicador de etapas */}
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Passo {step} de {STEPS.length}
            </p>
            <div className="flex gap-3 justify-center">
              {STEPS.map((label, i) => {
                const n = i + 1
                return (
                  <div key={label} className="flex flex-col items-center gap-1.5 min-w-[4rem]">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        n < step
                          ? "bg-green-500 text-white"
                          : n === step
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {n < step ? "✓" : n}
                    </div>
                    <span className={`text-xs ${n === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">WhatsApp Business</p>
              <p className="text-base text-muted-foreground leading-relaxed">
                {step === 1 && "Envie confirmações, lembretes e mensagens automáticas para seus clientes."}
                {step === 2 && "Baixe os apps, confira o número da barbearia e confirme que está pronto para conectar."}
                {step === 3 && "Conecte com a Meta em poucos cliques — login seguro, sem copiar códigos."}
                {step === 4 && "Quase lá! Ajuste lembretes e textos das mensagens na seção abaixo."}
              </p>
            </div>
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-3 text-left w-full">
              {[
                { icon: <CalendarCheck className="w-5 h-5 text-green-500" />, text: "Confirmação de agendamento" },
                { icon: <Clock3 className="w-5 h-5 text-blue-500" />, text: "Lembretes automáticos" },
                { icon: <Send className="w-5 h-5 text-primary" />, text: "Mensagens automáticas" },
                { icon: <Zap className="w-5 h-5 text-amber-500" />, text: "Atendimento automatizado" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/40 border border-border/60 px-4 py-3.5">
                  {item.icon}
                  <span className="text-base font-medium text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="w-full text-left space-y-5">
              <ShopPhoneEditor
                shopName={shopName}
                displayPhone={displayShopPhone}
                onSaveShopPhone={onSaveShopPhone}
                onSaved={() => setCheckNumber(false)}
              />

              <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </span>
                  <p className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    Passo a passo
                  </p>
                </div>
                <ol className="space-y-3 pl-9">
                  {PREP_STEPS.map((text, i) => (
                    <li key={text} className="flex gap-3 text-base text-muted-foreground leading-relaxed">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    3
                  </span>
                  <p className="text-base font-semibold text-foreground">Apps que você vai usar</p>
                </div>
                <div className="space-y-3 pl-9">
                  {REQUIRED_APPS.map((app) => (
                    <div key={app.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold"
                          style={{ backgroundColor: app.color }}
                        >
                          {app.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-foreground">{app.name}</p>
                          <p className="text-base text-muted-foreground mt-0.5">{app.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {app.links.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted/50 transition-colors"
                          >
                            {link.label}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    4
                  </span>
                  <p className="text-base font-semibold text-foreground">Confirme que está pronto</p>
                </div>
                <div className="space-y-2.5 pl-9">
                  {[
                    { checked: checkFb, set: setCheckFb, text: "Tenho conta Facebook ou Meta" },
                    { checked: checkWaBusiness, set: setCheckWaBusiness, text: "Meu número está no WhatsApp Business" },
                    { checked: checkNumber, set: setCheckNumber, text: "Confirmei que é o número da barbearia acima" },
                  ].map((item) => (
                    <label
                      key={item.text}
                      className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-4"
                    >
                      <Checkbox checked={item.checked} onCheckedChange={(v) => item.set(v === true)} className="mt-0.5 size-5" />
                      <span className="text-base text-foreground leading-relaxed">{item.text}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          )}

          {step === 3 && (
            <div className="w-full space-y-5 text-left">
              <section className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1877F2]/15 flex items-center justify-center">
                    <Facebook className="w-5 h-5 text-[#1877F2]" />
                  </div>
                  <p className="text-base font-semibold text-foreground">Login oficial da Meta</p>
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Ao clicar, abre a janela da Meta para autorizar o número{" "}
                  {displayShopPhone ? (
                    <strong className="text-foreground">{displayShopPhone}</strong>
                  ) : (
                    "da barbearia"
                  )}
                  . Sem token manual, sem complicação.
                </p>
                {onSaveShopPhone ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-primary text-sm"
                    onClick={() => goTo(2)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1 inline" />
                    Trocar número da barbearia
                  </Button>
                ) : null}
              </section>

              <section className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
                <p className="text-base font-semibold text-foreground">O que vai acontecer</p>
                <ol className="space-y-3">
                  {CONNECT_STEPS.map((text, i) => (
                    <li key={text} className="flex gap-3 text-base text-muted-foreground leading-relaxed">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-xs font-bold text-green-600 dark:text-green-400">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}

          {step === 3 && premium ? (
            <MetaCredentialsForm
              phone={phone}
              graphPhoneId={graphPhoneId}
              accessToken={accessToken}
              busy={busy}
              onPhoneChange={onPhoneChange}
              onGraphPhoneIdChange={onGraphPhoneIdChange}
              onAccessTokenChange={onAccessTokenChange}
              onSaveCredentials={onSaveCredentials}
            />
          ) : null}

          {step === 4 && (
            <div className="w-full space-y-4">
              {premium ? (
                <MetaCredentialsForm
                  phone={phone}
                  graphPhoneId={graphPhoneId}
                  accessToken={accessToken}
                  busy={busy}
                  onPhoneChange={onPhoneChange}
                  onGraphPhoneIdChange={onGraphPhoneIdChange}
                  onAccessTokenChange={onAccessTokenChange}
                  onSaveCredentials={onSaveCredentials}
                />
              ) : null}
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 text-left">
                <p className="text-base text-foreground leading-relaxed">
                  Depois de salvar o token acima, use <strong>Lembretes automáticos</strong> e{" "}
                  <strong>Textos das mensagens</strong> mais abaixo na página.
                </p>
              </div>
            </div>
          )}

          {/* Botões — sempre visíveis por etapa */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
            {step > 1 && step <= 4 && (
              <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={busy || connecting}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}

            {step === 1 && (
              <Button type="button" size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8" onClick={() => goTo(2)}>
                Começar configuração
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
              <>
                <Button
                  type="button"
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  disabled={busy || connecting}
                  onClick={() => void handleConnectMeta()}
                >
                  {connecting ? "Conectando…" : "Conectar WhatsApp"}
                  {!connecting && <Zap className="w-4 h-4 ml-2" />}
                </Button>
                <Button type="button" size="lg" variant="outline" disabled={busy || connecting} onClick={() => goTo(4)}>
                  Já tenho token — colar agora
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}

            {step === 4 && (
              <Button type="button" size="lg" className="bg-primary text-primary-foreground px-8" onClick={onScrollToSettings}>
                <Settings2 className="w-4 h-4 mr-2" />
                Ir para lembretes
              </Button>
            )}
          </div>

          {step === 2 && !stepReady && (
            <p className="text-base text-muted-foreground">Marque os três itens para continuar.</p>
          )}

          {!premium && step >= 3 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 w-full text-left">
              <p className="text-base font-semibold text-foreground">Plano Premium</p>
              <p className="text-base text-muted-foreground mt-1">
                A conexão do WhatsApp exige Premium.{" "}
                <a href="/painel/assinatura" className="text-primary underline font-medium">
                  Ver planos
                </a>
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-base w-full text-left">
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
