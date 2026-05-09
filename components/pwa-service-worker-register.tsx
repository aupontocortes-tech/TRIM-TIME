"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Registra /sw.js para o site ser tratado como PWA instalável (Chrome/Android: beforeinstallprompt).
 * Pass-through na rede — necessário principalmente para o fluxo “Instalar aplicativo”.
 *
 * Escopo depende da rota atual (re-executa ao navegar): /b/[slug] usa escopo da barbearia;
 * /painel usa "/". Em páginas que não são agendamento nem painel, não registramos (evita PWA “do painel” na landing).
 */
export function PwaServiceWorkerRegister() {
  const pathname = usePathname() || "/"

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    const isBooking = /^\/b\/[^/]+/.test(pathname)
    const isPainel = pathname.startsWith("/painel")

    if (!isBooking && !isPainel) {
      return
    }

    const scope = (() => {
      const m = /^\/b\/([^/]+)/.exec(pathname)
      return m ? `/b/${encodeURIComponent(m[1])}` : "/"
    })()

    navigator.serviceWorker.register("/sw.js", { scope }).catch(() => {
      /* ignore */
    })
  }, [pathname])

  return null
}
