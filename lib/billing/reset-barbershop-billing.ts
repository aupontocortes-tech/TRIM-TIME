import type { SubscriptionPlan } from "@/lib/db/types"
import {
  archiveAsaasCustomerReference,
  cancelAsaasSubscription,
  cancelPixAutomaticAuthorization,
  deleteAsaasPayment,
  findAsaasCustomerByReference,
  listAllSubscriptionPayments,
  listAsaasSubscriptionsByCustomer,
  listOpenAsaasPaymentsByCustomer,
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
  cardCleared: boolean
  asaasPaymentsDeleted: number
  asaasSubscriptionsCancelled: number
  asaasCustomerDetached: boolean
  warnings: string[]
}

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isOpenAsaasPaymentStatus(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === "PENDING" || s === "OVERDUE" || s === "AWAITING_RISK_ANALYSIS"
}

async function cancelSubscriptionAndOpenPayments(
  subscriptionId: string,
  warnings: string[]
): Promise<{ paymentsDeleted: number; cancelled: boolean }> {
  let paymentsDeleted = 0
  try {
    const payments = await listAllSubscriptionPayments(subscriptionId, "30")
    for (const p of payments) {
      if (!isOpenAsaasPaymentStatus(p.status ?? "")) continue
      try {
        await deleteAsaasPayment(p.id)
        paymentsDeleted++
      } catch (e) {
        warnings.push(
          `Não foi possível apagar cobrança ${p.id} no Asaas: ${e instanceof Error ? e.message : "erro"}`
        )
      }
    }
    await cancelAsaasSubscription(subscriptionId)
    return { paymentsDeleted, cancelled: true }
  } catch (e) {
    warnings.push(
      `Não foi possível cancelar assinatura ${subscriptionId} no Asaas: ${e instanceof Error ? e.message : "erro"}`
    )
    return { paymentsDeleted, cancelled: false }
  }
}

/** Apaga histórico de cobranças e reinicia assinatura para novo teste de contratação. */
export async function resetBarbershopBillingForFreshStart(
  barbershopId: string,
  options?: { keepCard?: boolean }
): Promise<ResetBarbershopBillingResult> {
  const keepCard = options?.keepCard === true
  const warnings: string[] = []

  const bs = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, name: true, role: true, isTest: true },
  })
  if (!bs) throw new Error("Barbearia não encontrada.")
  if (bs.role === "super_admin" || bs.isTest) {
    throw new Error(
      `Conta protegida (${bs.name}): super_admin e contas is_test não podem ter cobrança resetada pela API.`
    )
  }

  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })

  const deleted = await prisma.payment.deleteMany({ where: { barbershopId } })

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  let asaasPaymentsDeleted = 0
  let asaasSubscriptionsCancelled = 0
  let asaasCustomerDetached = false

  if (sub && (await isAsaasConfigured())) {
    try {
      if (sub.asaasPixAutomaticAuthId) {
        await cancelPixAutomaticAuthorization(sub.asaasPixAutomaticAuthId).catch(() => {})
      }

      const subscriptionIds = new Set<string>()
      if (sub.asaasSubscriptionId) subscriptionIds.add(sub.asaasSubscriptionId)

      let customerId = sub.asaasCustomerId
      if (!customerId) {
        const found = await findAsaasCustomerByReference(barbershopId)
        customerId = found?.id ?? null
      }

      if (customerId && !keepCard) {
        try {
          const subs = await listAsaasSubscriptionsByCustomer(customerId)
          for (const s of subs) {
            if (s.id) subscriptionIds.add(s.id)
          }
        } catch (e) {
          warnings.push(
            `Não foi possível listar assinaturas do cliente Asaas: ${e instanceof Error ? e.message : "erro"}`
          )
        }
      }

      for (const subscriptionId of subscriptionIds) {
        if (keepCard) {
          try {
            const catalog = await getPlanCatalog()
            const payments = await listAllSubscriptionPayments(subscriptionId, "30")
            for (const p of payments) {
              if (!isOpenAsaasPaymentStatus(p.status ?? "")) continue
              await deleteAsaasPayment(p.id).catch(() => {})
              asaasPaymentsDeleted++
            }
            await updateAsaasSubscription(subscriptionId, {
              value: catalog.plans[TRIAL_PLAN].price,
              billingType: (sub.billingType ?? "CREDIT_CARD") as AsaasBillingType,
              nextDueDate: formatDateYmd(trialEnd),
              updatePendingPayments: true,
            })
          } catch (e) {
            warnings.push(
              `Erro ao atualizar assinatura ${subscriptionId}: ${e instanceof Error ? e.message : "erro"}`
            )
          }
        } else {
          const result = await cancelSubscriptionAndOpenPayments(subscriptionId, warnings)
          asaasPaymentsDeleted += result.paymentsDeleted
          if (result.cancelled) asaasSubscriptionsCancelled++
        }
      }

      if (customerId && !keepCard) {
        try {
          const openPayments = await listOpenAsaasPaymentsByCustomer(customerId)
          for (const p of openPayments) {
            try {
              await deleteAsaasPayment(p.id)
              asaasPaymentsDeleted++
            } catch (e) {
              warnings.push(
                `Cobrança ${p.id} (R$ ${p.value}) não apagada no Asaas: ${e instanceof Error ? e.message : "erro"}`
              )
            }
          }
        } catch (e) {
          warnings.push(
            `Não foi possível listar cobranças abertas do cliente: ${e instanceof Error ? e.message : "erro"}`
          )
        }

        try {
          const remainingSubs = await listAsaasSubscriptionsByCustomer(customerId)
          for (const s of remainingSubs) {
            if (!s.id || subscriptionIds.has(s.id)) continue
            const result = await cancelSubscriptionAndOpenPayments(s.id, warnings)
            asaasPaymentsDeleted += result.paymentsDeleted
            if (result.cancelled) asaasSubscriptionsCancelled++
          }
        } catch (e) {
          warnings.push(
            `Não foi possível verificar assinaturas restantes: ${e instanceof Error ? e.message : "erro"}`
          )
        }
      }

      if (customerId && !keepCard) {
        try {
          await archiveAsaasCustomerReference(customerId, barbershopId)
          asaasCustomerDetached = true
        } catch (e) {
          warnings.push(
            `Cliente Asaas não foi desvinculado (cartão pode reaparecer): ${e instanceof Error ? e.message : "erro"}`
          )
        }
      }
    } catch (e) {
      warnings.push(`Limpeza Asaas incompleta: ${e instanceof Error ? e.message : "erro"}`)
    }
  } else if (sub?.asaasSubscriptionId || sub?.asaasCustomerId || sub?.cardSetupAt) {
    warnings.push(
      "Asaas não configurado no servidor — só o banco foi resetado. Configure ASAAS_API_KEY na Vercel."
    )
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
            asaasCustomerId: null,
            asaasSubscriptionId: null,
            asaasPixAutomaticAuthId: null,
            billingType: null,
          }),
    },
  })

  return {
    barbershopId: bs.id,
    barbershopName: bs.name,
    paymentsDeleted: deleted.count,
    cardKept: keepCard && !!sub?.cardSetupAt,
    cardCleared: !keepCard,
    asaasPaymentsDeleted,
    asaasSubscriptionsCancelled: keepCard ? 0 : asaasSubscriptionsCancelled,
    asaasCustomerDetached: keepCard ? false : asaasCustomerDetached,
    warnings,
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
