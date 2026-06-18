import type { SubscriptionPlan } from "@/lib/db/types"
import { TRIAL_DAYS, TRIAL_PLAN } from "@/lib/plans"
import { prisma } from "@/lib/prisma"

export type ResetBarbershopBillingResult = {
  barbershopId: string
  barbershopName: string
  paymentsDeleted: number
}

/** Apaga histórico de cobranças e reinicia assinatura para novo teste de contratação. */
export async function resetBarbershopBillingForFreshStart(
  barbershopId: string
): Promise<ResetBarbershopBillingResult> {
  const bs = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, name: true },
  })
  if (!bs) throw new Error("Barbearia não encontrada.")

  const deleted = await prisma.payment.deleteMany({ where: { barbershopId } })

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  await prisma.subscription.upsert({
    where: { barbershopId },
    create: {
      barbershopId,
      plan: TRIAL_PLAN satisfies SubscriptionPlan,
      status: "trial",
      trialEnd,
    },
    update: {
      plan: TRIAL_PLAN,
      status: "trial",
      trialEnd,
      nextPayment: null,
      postTrialChoice: null,
      cardSetupAt: null,
      graceAccessUntil: null,
    },
  })

  return {
    barbershopId: bs.id,
    barbershopName: bs.name,
    paymentsDeleted: deleted.count,
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
