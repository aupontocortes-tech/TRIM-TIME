"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChevronDown,
  ChevronUp,
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

type AppInstallPromptProps = {
  storageSuffix?: string
}

/**
 * Modal central + portal no body (não fica escondido atrás do header ou fora da tela).
 */
export function AppInstallPrompt({ storageSuffix = "" }: AppInstallPromptProps) {
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

  const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandaloneMode()) return

    const forceShow = shouldForceFromUrl()

    if (!forceShow) {
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

    setPlatform(detectPlatform())
    setShow(true)

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => window.removeEventListener("beforeinstallprompt", onBip)
  }, [hideKey])

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
                  Baixe o Trim Time
                </h2>
                <p className="text-sm text-muted-foreground leading-snug">
                  Instale como aplicativo no{" "}
                  <span className="text-foreground/90">Android</span>,{" "}
                  <span className="text-foreground/90">iPhone</span> ou{" "}
                  <span className="text-foreground/90">computador</span> — atalho
                  na tela inicial e uso em tela cheia.
                </p>
              </div>
            </div>

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

              {playStoreUrl ? (
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
              {appStoreUrl ? (
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
              Não apareceu? Tente{" "}
              <span className="text-foreground/90 font-medium">
                ?instalar=1
              </span>{" "}
              no final do link.
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
