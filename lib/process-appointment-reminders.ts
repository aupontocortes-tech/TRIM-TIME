import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { BarbershopNotificationSettings, BarbershopSettings } from "@/lib/db/types"
import { appointmentStartUtcMs } from "@/lib/appointment-reminder-time"
import { renderNotificationTemplate, type NotificationTemplateVars } from "@/lib/notification-template"
import { sendWebPushToClient } from "@/lib/web-push-send"
import { sendWhatsAppByProvider, type WhatsAppSendResult } from "@/lib/whatsapp-send-unified"
import { expireStaleAppointmentsWhere } from "@/lib/appointment-expiry"

const PRESET_REMINDER_OFFSETS = new Set([30, 60, 120, 1440])

function reminderOffsetsMinutes(ns: BarbershopNotificationSettings): number[] {
  const fromPresets = (ns.reminder_offsets_minutes ?? [60]).filter((n) => PRESET_REMINDER_OFFSETS.has(n))
  const out = new Set<number>(fromPresets)
  const custom = ns.reminder_custom_minutes
  if (typeof custom === "number" && Number.isFinite(custom)) {
    const m = Math.round(custom)
    if (m >= 5 && m <= 7 * 24 * 60) out.add(m)
  }
  return [...out].sort((a, b) => a - b)
}
const WINDOW_MS = 10 * 60 * 1000

const DEFAULT_APP =
  "Olá {{nome_cliente}}! Lembrete: você tem {{servico}} na {{barbearia}} em {{data}} às {{horario}}."
const DEFAULT_WA = "Olá {{nome}}, lembrando do seu horário amanhã às {{hora}}."

function formatDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  if (!y || !m || !d) return isoDate
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

function templateVars(appt: {
  client: { name: string }
  service: { name: string }
  barbershop: { name: string }
  date: Date
  time: string
}): NotificationTemplateVars {
  const ymd = appt.date.toISOString().slice(0, 10)
  return {
    nome_cliente: appt.client.name,
    servico: appt.service.name,
    barbearia: appt.barbershop.name,
    data: formatDatePt(ymd),
    horario: appt.time.slice(0, 5),
  }
}

export type ReminderRunStats = {
  appointments_scanned: number
  reminders_logged: number
  push_attempts: number
  push_ok: number
  whatsapp_attempts: number
  whatsapp_ok: number
}

/**
 * Processa lembretes de agendamento (chamado pelo cron a cada ~5 min).
 * Usa `barbershop.settings.notification_settings` e deduplica por `reminder_minutes` no `notification_log`.
 */
export async function processAppointmentReminders(): Promise<ReminderRunStats> {
  await expireStaleAppointmentsWhere({})

  const stats: ReminderRunStats = {
    appointments_scanned: 0,
    reminders_logged: 0,
    push_attempts: 0,
    push_ok: 0,
    whatsapp_attempts: 0,
    whatsapp_ok: 0,
  }

  const now = Date.now()
  const rangeStart = new Date(now - 24 * 60 * 60 * 1000)
  const rangeEnd = new Date(now + 48 * 60 * 60 * 1000)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      date: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      client: true,
      service: true,
      barbershop: true,
    },
  })

  stats.appointments_scanned = appointments.length

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""

  for (const appt of appointments) {
    const settings = (appt.barbershop.settings as BarbershopSettings | null)?.notification_settings
    const ns: BarbershopNotificationSettings = {
      reminder_offsets_minutes: [60],
      notify_app: true,
      notify_whatsapp: false,
      app_reminder_template: DEFAULT_APP,
      whatsapp_reminder_template: DEFAULT_WA,
      ...settings,
    }

    const offsets = reminderOffsetsMinutes(ns)
    if (offsets.length === 0) continue

    const apptStart = appointmentStartUtcMs(appt.date, appt.time)
    if (!Number.isFinite(apptStart)) continue

    const logs = await prisma.notificationLog.findMany({
      where: { appointmentId: appt.id, event: "appointment_reminder" },
      select: { payload: true },
    })
    const sentOffsets = new Set(
      logs
        .map((l) => {
          const p = l.payload as Record<string, unknown> | null
          return typeof p?.reminder_minutes === "number" ? p.reminder_minutes : null
        })
        .filter((x): x is number => x != null)
    )

    const vars = templateVars(appt)
    const appBody = renderNotificationTemplate(ns.app_reminder_template || DEFAULT_APP, vars)
    const waBody = renderNotificationTemplate(ns.whatsapp_reminder_template || DEFAULT_WA, vars)
    const openUrl = `${baseUrl}/b/${appt.barbershop.slug}`

    const waIntegration =
      ns.notify_whatsapp === true
        ? await prisma.whatsAppIntegration.findUnique({
            where: { barbershopId: appt.barbershopId },
          })
        : null

    for (const offsetMin of offsets) {
      if (sentOffsets.has(offsetMin)) continue
      const reminderAt = apptStart - offsetMin * 60_000
      if (now < reminderAt || now >= reminderAt + WINDOW_MS) continue

      const payload: Record<string, unknown> = {
        reminder_minutes: offsetMin,
        appointment_id: appt.id,
      }

      let pushResult: { ok: boolean; error?: string; skipped?: string } = {
        ok: false,
        skipped: "notify_app_off",
      }
      if (ns.notify_app !== false) {
        stats.push_attempts++
        pushResult = await sendWebPushToClient(appt.client.pushSubscription, {
          title: appt.barbershop.name,
          body: appBody,
          url: openUrl || `/b/${appt.barbershop.slug}`,
        })
        payload.push = pushResult
        if (pushResult.ok) stats.push_ok++
      }

      let waResult: WhatsAppSendResult = {
        ok: false,
        skipped: "notify_whatsapp_off",
      }
      if (ns.notify_whatsapp === true) {
        stats.whatsapp_attempts++
        const digits = (appt.client.phone ?? "").replace(/\D/g, "")
        waResult = await sendWhatsAppByProvider({
          integration: waIntegration,
          toDigits: digits,
          body: waBody,
        })
        payload.whatsapp = waResult
        if (waResult.ok) stats.whatsapp_ok++
      }

      await prisma.notificationLog.create({
        data: {
          barbershopId: appt.barbershopId,
          clientId: appt.clientId,
          appointmentId: appt.id,
          type: pushResult.ok ? "push" : waResult.ok ? "whatsapp" : "push",
          event: "appointment_reminder",
          payload: payload as Prisma.InputJsonValue,
        },
      })
      stats.reminders_logged++
    }
  }

  return stats
}
