"use client"

import { usePathname } from "next/navigation"
import { AppInstallPrompt } from "@/components/app-install-prompt"

/** Sem aviso no painel/plataforma (app já é uso “instalado” do barbeiro). */
function hideInstallPrompt(pathname: string): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/painel")) return true
  if (pathname.startsWith("/plataforma")) return true
  if (pathname.startsWith("/api")) return true
  if (pathname.startsWith("/_next")) return true
  return false
}

/**
 * Convite para instalar o PWA em páginas públicas.
 * Sem useSearchParams/Suspense — evita atraso ou fallback vazio no primeiro paint.
 */
export function GlobalAppInstallPrompt() {
  const pathname = usePathname() || ""
  if (hideInstallPrompt(pathname)) return null
  return <AppInstallPrompt />
}
