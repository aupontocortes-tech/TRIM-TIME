import type { SubscriptionPlan } from "@/lib/db/types"
import {
  deleteAsaasPayment,
  listAllSubscriptionPayments,
  updateAsaasSubscription,
  type AsaasBillingType,
} from "@/lib/asaas/client"
import { isAsaasConfigured } from "@/lib/asaas/config"
import { getPlanCatalog } from "@/lib/plan-catalog"
import { TRIAL_DAYS, TRIAL_PLAN } from "@/lib/plans"
import { prisma } from "@/lib/prisma"

export type ResetBarbershopBillingResult = {
  barbershopId: string
  barbershopName: string
  paymentsDeleted: number
  cardKept: boolean
  asaasPaymentsDeleted: number
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isOpenAsaasPaymentStatus(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === "PENDING" || s === "OVERDUE" || s === "AWAITING_RISK_ANALYSIS"
}

/** Apaga histórico de cobranças e reinicia assinatura para novo teste de contratação. */
export async function resetBarbershopBillingForFreshStart(
  barbershopId: string,
  options?: { keepCard?: boolean }
): Promise<ResetBarbershopBillingResult> {
  const keepCard = options?.keepCard === true
  const bs = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, name: true },
  })
  if (!bs) throw new Error("Barbearia não encontrada.")

  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })

  const deleted = await prisma.payment.deleteMany({ where: { barbershopId } })

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  let asaasPaymentsDeleted = 0
  if (keepCard && sub?.asaasSubscriptionId && (await isAsaasConfigured())) {
    try {
      const catalog = await getPlanCatalog()
      const payments = await listAllSubscriptionPayments(sub.asaasSubscriptionId, "30")
      for (const p of payments) {
        if (!isOpenAsaasPaymentStatus(p.status ?? "")) continue
        await deleteAsaasPayment(p.id).catch(() => {})
        asaasPaymentsDeleted++
      }
      await updateAsaasSubscription(sub.asaasSubscriptionId, {
        value: catalog.plans[TRIAL_PLAN].price,
        billingType: (sub.billingType ?? "CREDIT_CARD") as AsaasBillingType,
        nextDueDate: formatDateYmd(trialEnd),
        updatePendingPayments: true,
      })
    } catch (e) {
      console.warn("[reset-billing] asaas cleanup", barbershopId, e)
    }
  }

  await prisma.subscription.upsert({
    where: { barbershopId },
    create: {
      barbershopId,
      plan: TRIAL_PLAN satisfies SubscriptionPlan,
      status: "trial",
      trialEnd,
      ...(keepCard && sub?.cardSetupAt ? { cardSetupAt: sub.cardSetupAt } : {}),
      ...(keepCard && sub?.asaasCustomerId ? { asaasCustomerId: sub.asaasCustomerId } : {}),
      ...(keepCard && sub?.asaasSubscriptionId
        ? { asaasSubscriptionId: sub.asaasSubscriptionId }
        : {}),
      ...(keepCard && sub?.billingType ? { billingType: sub.billingType } : {}),
    },
    update: {
      plan: TRIAL_PLAN,
      status: "trial",
      trialEnd,
      nextPayment: null,
      postTrialChoice: null,
      graceAccessUntil: null,
      ...(keepCard
        ? {}
        : {
            cardSetupAt: null,
          }),
    },
  })

  return {
    barbershopId: bs.id,
    barbershopName: bs.name,
    paymentsDeleted: deleted.count,
    cardKept: keepCard && !!sub?.cardSetupAt,
    asaasPaymentsDeleted,
  }
}

export async function findBarbershopIdByNameOrSlug(query: string): Promise<string | null> {
  const q = query.trim()
  if (!q) return null
  const row = await prisma.barbershop.findFirst({
    where: {
      OR: [
        { name: { equals: q, mode: "insensitive" } },
        { slug: { equals: q, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  })
  return row?.id ?? null
}
