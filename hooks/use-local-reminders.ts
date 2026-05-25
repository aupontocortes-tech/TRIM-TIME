"use client"

import { useEffect, useCallback } from "react"
import {
  getDueReminders,
  fireReminderNotification,
  cleanupOldReminders,
} from "@/lib/local-reminders"

const CHECK_INTERVAL = 30_000

/**
 * Verifica lembretes locais a cada 30s e dispara notificação + vibração.
 * Também limpa lembretes antigos já disparados.
 */
export function useLocalReminders(enabled: boolean): void {
  const check = useCallback(() => {
    if (!enabled) return
    cleanupOldReminders()
    const due = getDueReminders()
    for (const reminder of due) {
      fireReminderNotification(reminder)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    check()
    const timer = window.setInterval(check, CHECK_INTERVAL)

    const onFocus = () => check()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check()
    })

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [enabled, check])
}
