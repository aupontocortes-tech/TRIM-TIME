"use client"

import { useCallback, useEffect, useState } from "react"
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

/** v3: reseta quem tinha fechado na v1/v2 e não via de novo */
const STORAGE_HIDE_KEY = "trimtime_install_prompt_hide_v3"
const STORAGE_HIDE_DAYS = 14

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true
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

type AppInstallPromptProps = {
  /** Chave extra para não misturar com outras telas (ex.: página de agendamento) */
  storageSuffix?: string
  /** Ignora “Agora não” salvo (ex.: URL com ?instalar=1) */
  forceShow?: boolean
}

/**
 * Convite para instalar o Trim Time como PWA (Android, desktop Chromium)
 * e instruções para “Adicionar à tela inicial” no iPhone/iPad (Safari).
 */
export function AppInstallPrompt({
  storageSuffix = "",
  forceShow = false,
}: AppInstallPromptProps) {
  const hideKey = STORAGE_HIDE_KEY + storageSuffix
  const [show, setShow] = useState(false)
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
    if (typeof window === "undefined") return
    if (isStandalone()) return

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
    // Pequeno atraso: garante paint após hidratação (alguns navegadores não mostravam o card).
    const t = window.setTimeout(() => setShow(true), 120)

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("beforeinstallprompt", onBip)
    }
  }, [hideKey, forceShow])

  const dismiss = useCallback(() => {
    setShow(false)
    try {
      localStorage.setItem(hideKey, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [hideKey])

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

  if (!show) return null

  const canInstallPwa = !!deferred
  const hasStoreLinks = !!(playStoreUrl || appStoreUrl)

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
      aria-live="polite"
      role="dialog"
      aria-labelledby="trimtime-install-title"
    >
      <Card className="pointer-events-auto max-w-lg mx-auto border-primary/30 shadow-xl bg-card/98 backdrop-blur-md ring-1 ring-primary/20">
        <CardContent className="p-4 relative">
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2
                id="trimtime-install-title"
                className="font-semibold text-foreground text-base leading-tight"
              >
                Baixe o Trim Time
              </h2>
              <p className="text-sm text-muted-foreground leading-snug">
                Instale como aplicativo no{" "}
                <span className="text-foreground/90">Android</span>,{" "}
                <span className="text-foreground/90">iPhone</span> ou{" "}
                <span className="text-foreground/90">computador</span> — atalho
                na tela inicial e experiência em tela cheia.
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
                <a href={playStoreUrl} target="_blank" rel="noopener noreferrer">
                  Google Play
                </a>
              </Button>
            ) : null}
            {appStoreUrl ? (
              <Button variant="outline" className="border-border" asChild>
                <a href={appStoreUrl} target="_blank" rel="noopener noreferrer">
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
                Toque no botão <strong className="text-foreground">Compartilhar</strong>{" "}
                (quadrado com seta para cima) na barra do Safari.
              </li>
              <li>
                Role e escolha{" "}
                <strong className="text-foreground">
                  Adicionar à Tela de Início
                </strong>
                .
              </li>
              <li>
                Confirme — o ícone do Trim Time aparecerá como um app.
              </li>
            </ol>
          ) : null}

          {platform === "desktop" && showDesktopHelp ? (
            <ul className="mt-3 text-xs text-muted-foreground space-y-1.5 border-t border-border pt-3">
              <li>
                <strong className="text-foreground">Chrome ou Edge:</strong>{" "}
                procure o ícone de instalação (⊕ ou monitor com seta) na barra de
                endereços e clique em <strong>Instalar</strong>.
              </li>
              <li>
                Ou use o menu do navegador:{" "}
                <strong className="text-foreground">
                  Instalar Trim Time…
                </strong>{" "}
                (se disponível).
              </li>
              {!hasStoreLinks && !canInstallPwa ? (
                <li className="text-amber-600/90 dark:text-amber-400/90">
                  No Safari para Mac a instalação como PWA é limitada; use
                  Chrome ou Edge para instalar no desktop.
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
              . Ou aguarde — às vezes o botão &quot;Instalar&quot; aparece na
              barra após alguns segundos.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export { isStandalone }
