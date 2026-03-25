"use client"

import { useEffect } from "react"

/**
 * Registra /sw.js para o site ser tratado como PWA instalável (Chrome/Android).
 * Pass-through na rede — necessário principalmente para o fluxo “Instalar aplicativo”.
 */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore */
    })
  }, [])

  return null
}
