import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import {
  buildInactiveClientMarketingVars,
  daysBetweenUtc,
  formatDateKey,
  parseInactiveClientMarketing,
} from "@/lib/inactive-client-marketing"
import { renderNotificationTemplate } from "@/lib/notification-template"
import { sendWhatsAppNotification, type WhatsAppSendResult } from "@/lib/whatsapp-send-unified"
import { hasFeature } from "@/lib/plans"
import { resolveEffectivePlanForBarbershop } from "@/lib/barbershop-effective-plan-server"

export type InactiveMarketingRunStats = {
  barbershops_scanned: number
  clients_scanned: number
  first_messages_attempted: number
  first_messages_ok: number
  second_messages_attempted: number
  second_messages_ok: number
}

type MarketingLogPayload = {
  attempt?: number
  last_visit_date?: string
  days_since_visit?: number
  whatsapp?: WhatsAppSendResult
}

function readMarketingLogs(payload: unknown): MarketingLogPayload {
  if (!payload || typeof payload !== "object") return {}
  return payload as MarketingLogPayload
}

export async function processInactiveClientMarketing(): Promise<InactiveMarketingRunStats> {
  const stats: InactiveMarketingRunStats = {
    barbershops_scanned: 0,
    clients_scanned: 0,
    first_messages_attempted: 0,
    first_messages_ok: 0,
    second_messages_attempted: 0,
    second_messages_ok: 0,
  }

  const today = new Date()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""

  const shops = await prisma.barbershop.findMany({
    where: { suspendedAt: null },
    select: { id: true, name: true, slug: true, settings: true },
  })

  for (const shop of shops) {
    stats.barbershops_scanned++
    const settings = (shop.settings ?? null) as BarbershopSettings | null
    const plan = await resolveEffectivePlanForBarbershop(shop.id)
    if (!plan || !hasFeature(plan, "whatsapp_integration")) continue

    const cfg = parseInactiveClientMarketing(settings, plan)
    if (!cfg) continue

    const integration = await prisma.whatsAppIntegration.findUnique({
      where: { barbershopId: shop.id },
    })
    if (!integration?.apiToken?.trim() || !integration.graphPhoneNumberId?.trim()) continue

    const clients = await prisma.client.findMany({
      where: {
        barbershopId: shop.id,
        phone: { not: null },
      },
      select: { id: true, name: true, phone: true },
    })
    if (clients.length === 0) continue

    const lastVisits = await prisma.appointment.groupBy({
      by: ["clientId"],
      where: {
        barbershopId: shop.id,
        status: "completed",
      },
      _max: { date: true },
    })

    const lastVisitByClient = new Map<string, Date>()
    for (const row of lastVisits) {
      const maxDate = row._max?.date
      if (!row.clientId || !maxDate) continue
      lastVisitByClient.set(row.clientId, maxDate)
    }

    const clientIds = clients.map((c) => c.id)
    const logs =
      clientIds.length > 0
        ? await prisma.notificationLog.findMany({
            where: {
              barbershopId: shop.id,
              clientId: { in: clientIds },
              event: "inactive_client_marketing",
            },
            select: { clientId: true, payload: true },
          })
        : []

    const logsByClient = new Map<string, MarketingLogPayload[]>()
    for (const log of logs) {
      if (!log.clientId) continue
      const list = logsByClient.get(log.clientId) ?? []
      list.push(readMarketingLogs(log.payload))
      logsByClient.set(log.clientId, list)
    }

    for (const client of clients) {
      const lastVisit = lastVisitByClient.get(client.id)
      if (!lastVisit) continue

      stats.clients_scanned++
      const daysSince = daysBetweenUtc(lastVisit, today)
      const lastVisitKey = formatDateKey(lastVisit)
      const clientLogs = logsByClient.get(client.id) ?? []

      const attempt1Sent = clientLogs.some(
        (l) => l.attempt === 1 && l.last_visit_date === lastVisitKey
      )
      const attempt2Sent = clientLogs.some(
        (l) => l.attempt === 2 && l.last_visit_date === lastVisitKey
      )

      if (daysSince >= cfg.stop_after_days) continue

      let attempt: 1 | 2 | null = null
      if (daysSince >= cfg.second_message_days && attempt1Sent && !attempt2Sent) {
        attempt = 2
      } else if (daysSince >= cfg.first_message_days && !attempt1Sent) {
        attempt = 1
      }
      if (!attempt) continue

      const phoneDigits = (client.phone ?? "").replace(/\D/g, "")
      if (phoneDigits.length < 10) continue

      const template =
        attempt === 1 ? cfg.whatsapp_first_template : cfg.whatsapp_second_template
      const body = renderNotificationTemplate(
        template,
        buildInactiveClientMarketingVars({
          clientName: client.name,
          barbershopName: shop.name,
          slug: shop.slug,
          daysSinceVisit: daysSince,
          baseUrl,
        })
      )

      if (attempt === 1) stats.first_messages_attempted++
      else stats.second_messages_attempted++

      const waResult = await sendWhatsAppNotification({
        integration,
        toDigits: phoneDigits,
        body,
      })

      if (attempt === 1 && waResult.ok) stats.first_messages_ok++
      if (attempt === 2 && waResult.ok) stats.second_messages_ok++

      await prisma.notificationLog.create({
        data: {
          barbershopId: shop.id,
          clientId: client.id,
          type: "whatsapp",
          event: "inactive_client_marketing",
          payload: {
            attempt,
            last_visit_date: lastVisitKey,
            days_since_visit: daysSince,
            whatsapp: waResult,
          } as Prisma.InputJsonValue,
        },
      })
    }
  }

  return stats
}
