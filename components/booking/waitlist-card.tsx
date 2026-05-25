"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Bell, Clock, Loader2, X } from "lucide-react"
import { WaitlistStatusBadge } from "./waitlist-status-badge"
import type { WaitlistItemUi } from "@/hooks/use-waitlist"

type WaitlistCardProps = {
  item: WaitlistItemUi
  acceptDeadlineMinutes: number | null
  acceptBusy: boolean
  cancelBusy: boolean
  onAccept: () => void
  onCancel: () => void
  fallbackBarberName?: string
  fallbackServiceName?: string
}

function CountdownTimer({
  notifiedAt,
  deadlineMinutes,
}: {
  notifiedAt: string
  deadlineMinutes: number
}) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    const calc = () => {
      const notified = new Date(notifiedAt).getTime()
      const deadline = notified + deadlineMinutes * 60_000
      const diff = Math.max(0, deadline - Date.now())
      setRemaining(Math.ceil(diff / 1000))
    }
    calc()
    const timer = window.setInterval(calc, 1000)
    return () => window.clearInterval(timer)
  }, [notifiedAt, deadlineMinutes])

  if (remaining === null) return null
  if (remaining <= 0) {
    return (
      <span className="text-xs text-destructive font-medium">Prazo expirado</span>
    )
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isUrgent = remaining < 120

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono font-medium ${
        isUrgent
          ? "text-destructive"
          : "text-amber-600 dark:text-amber-400"
      }`}
    >
      <Clock className="w-3 h-3" />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  )
}

export function WaitlistCard({
  item,
  acceptDeadlineMinutes,
  acceptBusy,
  cancelBusy,
  onAccept,
  onCancel,
  fallbackBarberName,
  fallbackServiceName,
}: WaitlistCardProps) {
  const isNotified =
    item.status === "notified" && item.offered_date && item.offered_time
  const barberName = item.barber?.name ?? fallbackBarberName ?? "Profissional"
  const serviceName = item.service?.name ?? fallbackServiceName ?? "Serviço"

  const borderClass = isNotified
    ? "border-blue-500/40 bg-blue-500/5"
    : "border-amber-500/30 bg-amber-500/5"

  return (
    <Card className={borderClass}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-sm text-foreground">
              Lista de espera
            </span>
          </div>
          <WaitlistStatusBadge status={item.status} />
        </div>

        {/* Info */}
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            {barberName} · {serviceName}
          </p>
          {item.desired_date && item.desired_time ? (
            <p className="text-xs text-muted-foreground">
              Horário desejado: {item.desired_date} às {item.desired_time.slice(0, 5)}
            </p>
          ) : null}
        </div>

        {/* Queue position */}
        {item.status === "waiting" && item.queue_position != null ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-foreground">
              Posição: <strong>{item.queue_position}º</strong>
            </span>
            {item.estimated_wait_minutes != null ? (
              <span className="text-muted-foreground">
                · Estimativa ~{item.estimated_wait_minutes} min
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Notified: offer card */}
        {isNotified ? (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">
                Horário liberado:{" "}
                <strong>
                  {item.offered_date} às {item.offered_time!.slice(0, 5)}
                </strong>
              </p>
              {acceptDeadlineMinutes && item.notified_at ? (
                <CountdownTimer
                  notifiedAt={item.notified_at}
                  deadlineMinutes={acceptDeadlineMinutes}
                />
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={acceptBusy}
                onClick={onAccept}
              >
                {acceptBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Confirmar horário
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={cancelBusy}
                onClick={onCancel}
              >
                {cancelBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <X className="w-4 h-4 mr-1" />
                )}
                Recusar
              </Button>
            </div>
          </div>
        ) : (
          /* Waiting: cancel action */
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Você será avisado quando surgir uma vaga.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:bg-destructive/10"
              disabled={cancelBusy}
              onClick={onCancel}
            >
              {cancelBusy ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : null}
              Sair da fila
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
