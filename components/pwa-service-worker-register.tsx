"use client"

import { useEffect } from "react"

/**
 * Registra /sw.js para o site ser tratado como PWA instalável (Chrome/Android).
 * Pass-through na rede — necessário principalmente para o fluxo “Instalar aplicativo”.
 */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const path = window.location.pathname || "/"
    // Para evitar conflito entre os PWAs ("/painel" vs "/b/[slug]"),
    // registramos o mesmo SW com escopo dedicado no fluxo público do cliente.
    const m = /^\/b\/([^/]+)\/?$/i.exec(path)
    const scope = m ? `/b/${encodeURIComponent(m[1])}` : "/"
    navigator.serviceWorker.register("/sw.js", { scope }).catch(() => {
      /* ignore */
    })
  }, [])

  return null
}
