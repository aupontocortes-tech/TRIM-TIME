"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Monitor,
  Smartphone,
  X,
} from "lucide-react"

/** v5: novo ciclo de exibição */
const STORAGE_HIDE_KEY = "trimtime_install_prompt_hide_v5"
const STORAGE_HIDE_DAYS = 14

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  )
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop"
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) return "ios"
  if (/Android/i.test(ua)) return "android"
  return "desktop"
}

function shouldForceFromUrl(): boolean {
  if (typeof window === "undefined") return false
  return /[?&](instalar|app|baixar)=(1|true|sim)(?:&|$)/i.test(
    window.location.search
  )
}

type InstallVariant = "default" | "clientBooking"

type AppInstallPromptProps = {
  storageSuffix?: string
  /** Página pública de agendamento (/b/slug): texto focado no cliente. */
  variant?: InstallVariant
}

/**
 * Modal central + portal no body (não fica escondido atrás do header ou fora da tela).
 */
export function AppInstallPrompt({
  storageSuffix = "",
  variant = "default",
}: AppInstallPromptProps) {
  const hideKey = STORAGE_HIDE_KEY + storageSuffix
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">(
    "desktop"
  )
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  )
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [showDesktopHelp, setShowDesktopHelp] = useState(false)
  const [installLinkCopied, setInstallLinkCopied] = useState(false)

  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandaloneMode()) return

    const forceShow = shouldForceFromUrl()
    /** Só ignora “já fechei” quando a URL pede instalação — evita modal bloqueando /b/slug no celular */
    const skipLocalStorageHide = forceShow

    if (!skipLocalStorageHide) {
      try {
        const raw = localStorage.getItem(hideKey)
        if (raw) {
          const t = parseInt(raw, 10)
          if (!Number.isNaN(t)) {
            const days = (Date.now() - t) / (1000 * 60 * 60 * 24)
            if (days < STORAGE_HIDE_DAYS) return
          }
        }
      } catch {
        /* ignore */
      }
    }

    const detected = detectPlatform()
    setPlatform(detected)
    if (detected === "ios") setShowIosHelp(true)
    setShow(true)

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => window.removeEventListener("beforeinstallprompt", onBip)
  }, [hideKey])

  const bookingInstallHref =
    typeof window !== "undefined"
      ? (() => {
          try {
            const u = new URL(window.location.href)
            u.searchParams.set("instalar", "1")
            return u.toString()
          } catch {
            return ""
          }
        })()
      : ""

  const copyBookingInstallLink = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      const u = new URL(window.location.href)
      u.searchParams.set("instalar", "1")
      void navigator.clipboard.writeText(u.toString())
      setInstallLinkCopied(true)
      window.setTimeout(() => setInstallLinkCopied(false), 2500)
    } catch {
      /* ignore */
    }
  }, [])

  const dismiss = useCallback(() => {
    setShow(false)
    try {
      localStorage.setItem(hideKey, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [hideKey])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [show, dismiss])

  const runInstall = useCallback(async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } catch {
      /* ignore */
    }
    setDeferred(null)
  }, [deferred])

  if (!mounted || !show || typeof document === "undefined") return null

  const canInstallPwa = !!deferred
  const hasStoreLinks = !!(playStoreUrl || appStoreUrl)

  const title =
    variant === "clientBooking"
      ? "Atalho só para agendar"
      : "Baixe o Trim Time"
  const subtitle =
    variant === "clientBooking"
      ? "Este link é só para clientes marcarem horário — é separado do app do barbeiro. Abra no Chrome ou Safari, adicione à tela inicial e use como um app de agendamento (ícone na home, tela cheia)."
      : "Instale como aplicativo no Android, iPhone ou computador — atalho na tela inicial e uso em tela cheia."

  const modal = (
    <div className="trimtime-install-root" data-trimtime-install="">
      {/* Fundo: cobre header fixo da landing (z-50) e o restante */}
      <button
        type="button"
        className="fixed inset-0 z-[2147483646] bg-black/60 backdrop-blur-[2px] border-0 cursor-default p-0 m-0 w-full h-full"
        aria-label="Fechar aviso de instalação"
        onClick={dismiss}
      />
      <div
        className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trimtime-install-title"
      >
        <Card
          className="pointer-events-auto w-full max-w-lg max-h-[min(90vh,640px)] overflow-y-auto border-primary/40 shadow-2xl bg-card ring-2 ring-primary/25 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <CardContent className="p-4 sm:p-5 relative">
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary z-10"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-10">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2
                  id="trimtime-install-title"
                  className="font-semibold text-foreground text-lg leading-tight"
                >
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground leading-snug">{subtitle}</p>
              </div>
            </div>

            {variant === "clientBooking" ? (
              <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-foreground">
                  Guarde o link da barbearia: ao colar no navegador você instala só a página de agendamento, não o
                  painel do profissional. No celular, use os botões abaixo se precisar abrir na loja.
                </p>
                <div className="flex flex-col gap-2">
                  {playStoreUrl ? (
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                      <a href={playStoreUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-2 shrink-0" />
                        Baixar no Google Play
                      </a>
                    </Button>
                  ) : null}
                  {appStoreUrl ? (
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                      <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-2 shrink-0" />
                        Baixar na App Store
                      </a>
                    </Button>
                  ) : null}
                  {bookingInstallHref ? (
                    <Button variant="outline" className="w-full border-border" asChild>
                      <a href={bookingInstallHref} target="_blank" rel="noopener noreferrer">
                        <Smartphone className="w-4 h-4 mr-2 shrink-0" />
                        Abrir esta página no navegador (instalar PWA)
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => void copyBookingInstallLink()}
                  >
                    <Copy className="w-4 h-4 mr-2 shrink-0" />
                    {installLinkCopied ? "Link copiado!" : "Copiar link com instalação (?instalar=1)"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col sm:flex-row gap-2 flex-wrap">
              {canInstallPwa ? (
                <Button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={runInstall}
                >
                  <Smartphone className="w-4 h-4 mr-2 shrink-0" />
                  Instalar aplicativo
                </Button>
              ) : null}

              {variant !== "clientBooking" && playStoreUrl ? (
                <Button variant="outline" className="border-border" asChild>
                  <a
                    href={playStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Play
                  </a>
                </Button>
              ) : null}
              {variant !== "clientBooking" && appStoreUrl ? (
                <Button variant="outline" className="border-border" asChild>
                  <a
                    href={appStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    App Store
                  </a>
                </Button>
              ) : null}

              {platform === "ios" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  onClick={() => setShowIosHelp((v) => !v)}
                >
                  {showIosHelp ? (
                    <ChevronUp className="w-4 h-4 mr-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 mr-2" />
                  )}
                  iPhone / iPad (Safari)
                </Button>
              ) : null}

              {!canInstallPwa && platform === "desktop" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border"
                  onClick={() => setShowDesktopHelp((v) => !v)}
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  {showDesktopHelp ? "Ocultar" : "Computador (Chrome / Edge)"}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground sm:ml-auto"
                onClick={dismiss}
              >
                Agora não
              </Button>
            </div>

            {platform === "ios" && showIosHelp ? (
              <ol className="mt-3 text-xs text-muted-foreground space-y-1.5 list-decimal list-inside border-t border-border pt-3">
                <li>
                  Toque no botão{" "}
                  <strong className="text-foreground">Compartilhar</strong> na
                  barra do Safari.
                </li>
                <li>
                  Escolha{" "}
                  <strong className="text-foreground">
                    Adicionar à Tela de Início
                  </strong>
                  .
                </li>
                <li>Confirme — o ícone aparecerá como um app.</li>
              </ol>
            ) : null}

            {platform === "desktop" && showDesktopHelp ? (
              <ul className="mt-3 text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
                <li>
                  <strong className="text-foreground">Chrome ou Edge:</strong>{" "}
                  ícone de instalar na barra de endereços →{" "}
                  <strong>Instalar</strong>.
                </li>
                <li>
                  Ou menu do navegador:{" "}
                  <strong className="text-foreground">
                    Instalar Trim Time…
                  </strong>
                </li>
                {!hasStoreLinks && !canInstallPwa ? (
                  <li className="text-amber-600/90 dark:text-amber-400/90">
                    No Safari (Mac) use Chrome ou Edge para instalar no desktop.
                  </li>
                ) : null}
              </ul>
            ) : null}

            {!canInstallPwa && platform === "android" ? (
              <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
                No <strong className="text-foreground">Chrome</strong>: menu{" "}
                <strong className="text-foreground">⋮</strong> →{" "}
                <strong className="text-foreground">
                  Instalar app / Adicionar à tela inicial
                </strong>
                .
              </p>
            ) : null}

            <p className="mt-3 text-[11px] text-muted-foreground/80 text-center">
              {variant === "clientBooking"
                ? "O aviso sumiu? Peça o link de novo e acrescente "
                : "Não apareceu? Tente "}
              <span className="text-foreground/90 font-medium">?instalar=1</span>
              {variant === "clientBooking"
                ? " no final da URL para mostrar esta mensagem de novo."
                : " no final do link."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

/** @deprecated use isStandaloneMode via copy — mantido para compat */
export function isStandalone(): boolean {
  return isStandaloneMode()
}
