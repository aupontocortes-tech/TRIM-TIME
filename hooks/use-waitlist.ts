"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export type WaitlistItemUi = {
  id: string
  status: string
  queue_position: number | null
  queue_ahead: number | null
  estimated_wait_minutes: number | null
  desired_date?: string | null
  desired_time?: string | null
  offered_date?: string | null
  offered_time?: string | null
  notified_at?: string | null
  barber?: { id?: string; name?: string }
  service?: { id?: string; name?: string }
}

type JoinPayload = {
  barber_id: string
  service_ids: string[]
  date: string
  time: string
}

type UseWaitlistReturn = {
  item: WaitlistItemUi | null
  loading: boolean
  joinBusy: boolean
  acceptBusy: boolean
  cancelBusy: boolean
  error: string
  join: (payload: JoinPayload) => Promise<boolean>
  accept: () => Promise<{ ok: boolean; appointmentIds?: string[] }>
  cancel: () => Promise<boolean>
  clearError: () => void
  restoring: boolean
}

const POLL_INTERVAL = 15_000

export function useWaitlist(
  slug: string,
  waitlistEnabled: boolean,
  isLoggedIn: boolean
): UseWaitlistReturn {
  const [item, setItem] = useState<WaitlistItemUi | null>(null)
  const [loading, setLoading] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [error, setError] = useState("")
  const [restoring, setRestoring] = useState(true)
  const restoredRef = useRef(false)

  const apiBase = `/api/public/barbershops/${encodeURIComponent(slug)}/waitlist`

  const fetchActive = useCallback(async () => {
    if (!waitlistEnabled || !isLoggedIn) {
      setRestoring(false)
      return
    }
    try {
      const r = await fetch(apiBase, { credentials: "include", cache: "no-store" })
      if (!r.ok) {
        setRestoring(false)
        return
      }
      const data = (await r.json()) as { items?: WaitlistItemUi[] }
      const active = data.items?.find(
        (x) => x.status === "waiting" || x.status === "notified"
      )
      if (active) setItem(active)
      else setItem(null)
    } catch {
      /* network error — keep current state */
    } finally {
      setRestoring(false)
    }
  }, [apiBase, waitlistEnabled, isLoggedIn])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    void fetchActive()
  }, [fetchActive])

  useEffect(() => {
    if (!item?.id || !waitlistEnabled || !isLoggedIn) return
    const poll = () => void fetchActive()
    const timer = window.setInterval(poll, POLL_INTERVAL)
    return () => window.clearInterval(timer)
  }, [item?.id, waitlistEnabled, isLoggedIn, fetchActive])

  const join = useCallback(
    async (payload: JoinPayload): Promise<boolean> => {
      setJoinBusy(true)
      setError("")
      try {
        const r = await fetch(apiBase, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const j = (await r.json().catch(() => ({}))) as {
          error?: string
          item?: WaitlistItemUi
        }
        if (!r.ok) {
          setError(j.error || "Não foi possível entrar na fila.")
          return false
        }
        if (j.item) setItem(j.item)
        return true
      } catch {
        setError("Erro ao entrar na fila.")
        return false
      } finally {
        setJoinBusy(false)
      }
    },
    [apiBase]
  )

  const accept = useCallback(async (): Promise<{
    ok: boolean
    appointmentIds?: string[]
  }> => {
    if (!item?.id) return { ok: false }
    setAcceptBusy(true)
    setError("")
    try {
      const r = await fetch(`${apiBase}/${encodeURIComponent(item.id)}/accept`, {
        method: "POST",
        credentials: "include",
      })
      const j = (await r.json().catch(() => ({}))) as {
        error?: string
        appointment_ids?: string[]
      }
      if (!r.ok) {
        setError(j.error || "Não foi possível confirmar o horário.")
        return { ok: false }
      }
      setItem(null)
      return { ok: true, appointmentIds: j.appointment_ids }
    } catch {
      setError("Erro ao confirmar o horário.")
      return { ok: false }
    } finally {
      setAcceptBusy(false)
    }
  }, [apiBase, item?.id])

  const cancelItem = useCallback(async (): Promise<boolean> => {
    if (!item?.id) return false
    setCancelBusy(true)
    setError("")
    try {
      const r = await fetch(`${apiBase}/${encodeURIComponent(item.id)}/cancel`, {
        method: "POST",
        credentials: "include",
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setError(j.error || "Não foi possível sair da fila.")
        return false
      }
      setItem(null)
      return true
    } catch {
      setError("Erro ao sair da fila.")
      return false
    } finally {
      setCancelBusy(false)
    }
  }, [apiBase, item?.id])

  const clearError = useCallback(() => setError(""), [])

  return {
    item,
    loading,
    joinBusy,
    acceptBusy,
    cancelBusy,
    error,
    join,
    accept,
    cancel: cancelItem,
    clearError,
    restoring,
  }
}
