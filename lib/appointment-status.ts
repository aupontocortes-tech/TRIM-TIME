import type { AppointmentStatus } from "@/lib/db/types"
import { shopTodayYmd, ymdFromDbDate } from "@/lib/waitlist-expiry"

/** Status exibidos na agenda ativa (dia corrente e futuro). */
export const AGENDA_ACTIVE_STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "pending_finalization",
]

/** Status finais visíveis no histórico. */
export const APPOINTMENT_HISTORY_STATUSES: AppointmentStatus[] = [
  "pending_finalization",
  "completed",
  "canceled",
  "no_show",
]

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  pending_finalization: "Pendente de finalização",
  completed: "Finalizado",
  canceled: "Cancelado",
  no_show: "Não compareceu",
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status
}

export function appointmentStatusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case "confirmed":
      return "bg-green-500/10 text-green-500"
    case "completed":
      return "bg-blue-500/10 text-blue-500"
    case "pending_finalization":
      return "bg-orange-500/10 text-orange-500"
    case "canceled":
      return "bg-destructive/10 text-destructive"
    case "no_show":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-yellow-500/10 text-yellow-500"
  }
}

export function isAgendaActiveStatus(status: AppointmentStatus): boolean {
  return AGENDA_ACTIVE_STATUSES.includes(status)
}

export function appointmentDateYmd(date: Date | string): string {
  if (typeof date === "string") return date.slice(0, 10)
  return ymdFromDbDate(date)
}

/** Agenda: só dias de hoje em diante com status ativo. */
export function isAppointmentInAgendaView(args: {
  status: AppointmentStatus
  date: Date | string
  todayYmd?: string
}): boolean {
  const today = args.todayYmd ?? shopTodayYmd()
  const ymd = appointmentDateYmd(args.date)
  if (ymd < today) return false
  return isAgendaActiveStatus(args.status)
}

/** Histórico: dias passados ou encerrados no dia. */
export function isAppointmentInHistoryView(args: {
  status: AppointmentStatus
  date: Date | string
  todayYmd?: string
}): boolean {
  const today = args.todayYmd ?? shopTodayYmd()
  const ymd = appointmentDateYmd(args.date)
  if (ymd < today) return true
  return ["completed", "canceled", "no_show"].includes(args.status)
}

export function canceledRetentionDays(settings?: { appointment_canceled_retention_days?: number | null } | null): number {
  const raw = settings?.appointment_canceled_retention_days
  if (raw === 0) return 0
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw)
  return 90
}
