"use client"

import { Suspense, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { AppInstallPrompt } from "@/components/app-install-prompt"

/** Rotas onde o dono trabalha no painel — sem cartão de instalação. */
function isPanelOrInternalRoute(pathname: string): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/painel")) return true
  if (pathname.startsWith("/admin")) return true
  if (pathname.startsWith("/api")) return true
  if (pathname.startsWith("/_next")) return true
  return false
}

function GlobalAppInstallPromptInner() {
  const pathname = usePathname() || ""
  const searchParams = useSearchParams()

  const forceShow = useMemo(() => {
    const q = searchParams.get("instalar") || searchParams.get("app") || searchParams.get("baixar")
    return q === "1" || q === "true" || q === "sim"
  }, [searchParams])

  if (isPanelOrInternalRoute(pathname)) return null

  return <AppInstallPrompt forceShow={forceShow} />
}

/**
 * Exibe o convite para instalar o PWA em qualquer página pública
 * (landing, login, link de agendamento /b/..., etc.).
 */
export function GlobalAppInstallPrompt() {
  return (
    <Suspense fallback={null}>
      <GlobalAppInstallPromptInner />
    </Suspense>
  )
}
