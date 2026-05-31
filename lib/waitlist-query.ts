import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"
import {
  dateFromYmd,
  isDesiredDateWaitlistExpired,
  shopTodayYmd,
  ymdFromDbDate,
} from "@/lib/waitlist-expiry"

const WAITLIST_NO_DATE_TTL_DAYS = 7

export type WaitlistView = "active" | "history" | "all"

/** Filtro Prisma para a fila ativa (hoje e dias futuros, aguardando/notificado). */
export function waitlistActiveWhere(barbershopId: string): Prisma.WaitingListItemWhereInput {
  const today = shopTodayYmd()
  return {
    barbershopId,
    status: { in: ["waiting", "notified"] },
    OR: [
      { desiredDate: { gte: dateFromYmd(today) } },
      {
        desiredDate: null,
        createdAt: { gte: new Date(Date.now() - WAITLIST_NO_DATE_TTL_DAYS * 24 * 60 * 60_000) },
      },
    ],
  }
}

/** Filtro Prisma para histórico (encerrados ou dias passados). */
export function waitlistHistoryWhere(barbershopId: string): Prisma.WaitingListItemWhereInput {
  const today = shopTodayYmd()
  return {
    barbershopId,
    OR: [
      { status: { in: ["expired", "canceled", "accepted"] } },
      {
        status: { in: ["waiting", "notified"] },
        desiredDate: { lt: dateFromYmd(today) },
      },
    ],
  }
}

export function waitlistWhereForView(
  barbershopId: string,
  view: WaitlistView
): Prisma.WaitingListItemWhereInput {
  if (view === "active") return waitlistActiveWhere(barbershopId)
  if (view === "history") return waitlistHistoryWhere(barbershopId)
  return { barbershopId }
}

/**
 * Expira itens cuja data desejada já passou (após horário de fechamento da loja naquele dia).
 */
export async function expirePastDesiredDateWaitlistItems(barbershopId: string): Promise<number> {
  const bs = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { settings: true },
  })
  const settings = (bs?.settings as BarbershopSettings | null) ?? null
  const now = new Date()

  const candidates = await prisma.waitingListItem.findMany({
    where: {
      barbershopId,
      status: { in: ["waiting", "notified"] },
      desiredDate: { not: null },
    },
    select: { id: true, desiredDate: true },
  })

  const ids = candidates
    .filter((row) => row.desiredDate && isDesiredDateWaitlistExpired(row.desiredDate, settings, now))
    .map((row) => row.id)

  if (ids.length === 0) return 0

  const result = await prisma.waitingListItem.updateMany({
    where: { id: { in: ids } },
    data: { status: "expired" },
  })
  return result.count
}

/** Fallback: itens sem data desejada expiram após 7 dias em fila. */
export async function expireOldWaitingItemsWithoutDate(barbershopId: string): Promise<number> {
  const cutoff = new Date(Date.now() - WAITLIST_NO_DATE_TTL_DAYS * 24 * 60 * 60_000)
  const result = await prisma.waitingListItem.updateMany({
    where: {
      barbershopId,
      status: { in: ["waiting", "notified"] },
      desiredDate: null,
      createdAt: { lt: cutoff },
    },
    data: { status: "expired" },
  })
  return result.count
}

/** Ordenação padrão da fila ativa: dia → VIP → ordem de entrada. */
export const waitlistActiveOrderBy: Prisma.WaitingListItemOrderByWithRelationInput[] = [
  { desiredDate: "asc" },
  { priority: "desc" },
  { createdAt: "asc" },
]

export const waitlistHistoryOrderBy: Prisma.WaitingListItemOrderByWithRelationInput[] = [
  { desiredDate: "desc" },
  { createdAt: "desc" },
]

export { ymdFromDbDate, shopTodayYmd, formatWaitlistDayLabel } from "@/lib/waitlist-expiry"
