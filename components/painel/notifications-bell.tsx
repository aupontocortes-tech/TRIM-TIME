"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, CalendarPlus, CalendarX2, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type PainelNotification = {
  id: string
  kind: "new_appointment" | "canceled" | "waitlist"
  clientName: string
  serviceName: string | null
  barberName: string | null
  when: string
  apptDate: string | null
  apptTime: string | null
}

const POLL_MS = 60_000

function seenStorageKey(barbershopId?: string | null): string {
  return `trimtime_notif_seen_${barbershopId ?? "default"}`
}

function readLastSeen(barbershopId?: string | null): number {
  if (typeof window === "undefined") return 0
  const raw = window.localStorage.getItem(seenStorageKey(barbershopId))
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) ? n : 0
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ""
  const diffMs = Date.now() - then
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return "agora"
  if (min < 60) return `há ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days} d`
  return new Date(iso).toLocaleDateString("pt-BR")
}

function formatApptWhen(dateIso: string | null, time: string | null): string | null {
  if (!dateIso) return null
  const d = new Date(dateIso)
  if (!Number.isFinite(d.getTime())) return null
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
  const hhmm = time ? time.slice(0, 5) : null
  return hhmm ? `${day} às ${hhmm}` : day
}

const KIND_META: Record<
  PainelNotification["kind"],
  { icon: typeof Bell; label: string; className: string }
> = {
  new_appointment: { icon: CalendarPlus, label: "Novo agendamento", className: "text-emerald-500" },
  canceled: { icon: CalendarX2, label: "Cancelamento", className: "text-destructive" },
  waitlist: { icon: Clock, label: "Lista de espera", className: "text-amber-500" },
}

export function NotificationsBell({
  barbershopId,
  selectedUnitId,
}: {
  barbershopId?: string | null
  selectedUnitId?: string | null
}) {
  const [events, setEvents] = useState<PainelNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState(0)
  const loadedOnce = useRef(false)

  useEffect(() => {
    setLastSeen(readLastSeen(barbershopId))
  }, [barbershopId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/painel/notifications", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { events?: PainelNotification[] }
      setEvents(Array.isArray(data.events) ? data.events : [])
      loadedOnce.current = true
    } catch {
      // silencioso: sino não deve quebrar o painel
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [load, selectedUnitId])

  const unreadCount = useMemo(
    () => events.filter((e) => new Date(e.when).getTime() > lastSeen).length,
    [events, lastSeen]
  )

  const markAllSeen = useCallback(() => {
    const newest = events.reduce((max, e) => Math.max(max, new Date(e.when).getTime()), 0)
    const seenAt = Math.max(newest, Date.now())
    setLastSeen(seenAt)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(seenStorageKey(barbershopId), String(seenAt))
    }
  }, [events, barbershopId])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      void load()
      markAllSeen()
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          type="button"
          aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"}
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notificações</span>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {loadedOnce.current ? "Nenhuma novidade por aqui." : "Carregando..."}
            </div>
          ) : (
            events.map((e) => {
              const meta = KIND_META[e.kind]
              const Icon = meta.icon
              const apptWhen = formatApptWhen(e.apptDate, e.apptTime)
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0"
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.className}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{meta.label}</span>
                      {" — "}
                      {e.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[e.serviceName, e.barberName].filter(Boolean).join(" • ")}
                      {apptWhen ? `${e.serviceName || e.barberName ? " • " : ""}${apptWhen}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatRelative(e.when)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
