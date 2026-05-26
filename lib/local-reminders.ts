/**
 * Lembretes locais de agendamento via localStorage + Service Worker.
 *
 * Offsets: 1 dia (1440 min), 1 hora (60 min), 15 min antes do serviço.
 * Cada lembrete é salvo no localStorage e verificado periodicamente.
 * Quando chega a hora, o Service Worker exibe a notificação com vibração.
 */

const STORAGE_KEY = "trimtime_local_reminders"
const REMINDER_OFFSETS_MINUTES = [1440, 60, 15] as const

export type LocalReminder = {
  id: string
  appointmentDate: string
  appointmentTime: string
  fireAt: number
  offsetMinutes: number
  barbershopName: string
  barberName: string
  serviceName: string
  slug: string
  fired: boolean
}

export type ScheduleReminderInput = {
  appointmentId: string
  appointmentDate: string
  appointmentTime: string
  barbershopName: string
  barberName: string
  serviceName: string
  slug: string
}

function appointmentTimestamp(dateStr: string, timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  const d = new Date(dateStr + "T00:00:00")
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

export function loadReminders(): LocalReminder[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LocalReminder[]
  } catch {
    return []
  }
}

function saveReminders(items: LocalReminder[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* quota exceeded — ignore */
  }
}

export function scheduleReminders(input: ScheduleReminderInput): void {
  const ts = appointmentTimestamp(input.appointmentDate, input.appointmentTime)
  if (!ts || isNaN(ts)) return

  const existing = loadReminders()

  const newReminders: LocalReminder[] = REMINDER_OFFSETS_MINUTES.map((offset) => ({
    id: `${input.appointmentId}_${offset}`,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    fireAt: ts - offset * 60_000,
    offsetMinutes: offset,
    barbershopName: input.barbershopName,
    barberName: input.barberName,
    serviceName: input.serviceName,
    slug: input.slug,
    fired: false,
  }))

  const appointmentPrefix = `${input.appointmentId}_`
  const filtered = existing.filter((r) => !r.id.startsWith(appointmentPrefix))

  const now = Date.now()
  const combined = [...filtered, ...newReminders.filter((r) => r.fireAt > now)]

  saveReminders(combined)
}

export function cancelReminders(appointmentId: string): void {
  const existing = loadReminders()
  const prefix = `${appointmentId}_`
  const filtered = existing.filter((r) => !r.id.startsWith(prefix))
  saveReminders(filtered)
}

function offsetLabel(minutes: number): string {
  if (minutes >= 1440) return "1 dia"
  if (minutes >= 60) return `${Math.round(minutes / 60)} hora`
  return `${minutes} minutos`
}

export function getDueReminders(): LocalReminder[] {
  const all = loadReminders()
  const now = Date.now()
  return all.filter((r) => !r.fired && r.fireAt <= now)
}

export function markReminderFired(id: string): void {
  const all = loadReminders()
  const updated = all.map((r) => (r.id === id ? { ...r, fired: true } : r))
  saveReminders(updated)
}

export function cleanupOldReminders(): void {
  const all = loadReminders()
  const cutoff = Date.now() - 24 * 60 * 60_000
  const filtered = all.filter((r) => r.fireAt > cutoff || (!r.fired && r.fireAt > Date.now()))
  if (filtered.length !== all.length) saveReminders(filtered)
}

export function fireReminderNotification(reminder: LocalReminder): void {
  const label = offsetLabel(reminder.offsetMinutes)
  const title = `📅 ${reminder.barbershopName}`
  const body = `Falta ${label} para o seu ${reminder.serviceName} com ${reminder.barberName} às ${reminder.appointmentTime.slice(0, 5)}. Não se atrase!`
  const url = `/b/${reminder.slug}`
  const tag = `reminder-${reminder.id}`

  if ("vibrate" in navigator) {
    try { navigator.vibrate([200, 100, 200]) } catch { /* unsupported */ }
  }

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_LOCAL_NOTIFICATION",
      title,
      body,
      url,
      tag,
    })
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      tag,
      silent: false,
    })
  }

  markReminderFired(reminder.id)
}
