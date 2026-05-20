import type { SubscriptionPlan } from "@/lib/db/types"
import type { TrialCardSetupPayload } from "@/lib/asaas/card-types"
import {
  digitsOnly,
  normalizeCardNumber,
  normalizeExpiryMonth,
  normalizeExpiryYear,
} from "@/lib/asaas/card-types"
import {
  cancelAsaasSubscription,
  createAsaasCustomer,
  createAsaasSubscription,
  findAsaasCustomerByReference,
  listSubscriptionPayments,
  tokenizeAsaasCreditCard,
  updateAsaasSubscription,
  updateAsaasSubscriptionCreditCard,
  type AsaasBillingType,
} from "@/lib/asaas/client"
import { getAppBaseUrl, isAsaasConfigured } from "@/lib/asaas/config"
import { getPlanCatalog, getPlanPrice } from "@/lib/plan-catalog"
import { isPaymentApiActive } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import { createGraceAccessUntilDate } from "@/lib/subscription"

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d)
  next.setMonth(next.getMonth() + months)
  return next
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

/** Cobrança só após aceite: data distante para validar cartão sem debitar no trial. */
function deferredChargeDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 2)
  return formatDateYmd(d)
}

export async function isBillingEnabled(): Promise<boolean> {
  if (!isAsaasConfigured()) return false
  return isPaymentApiActive()
}

export async function ensureAsaasCustomer(barbershopId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { barbershopId },
    include: { barbershop: true },
  })
  if (!sub?.barbershop) throw new Error("Barbearia não encontrada")
  if (sub.asaasCustomerId) return sub.asaasCustomerId

  const existing = await findAsaasCustomerByReference(barbershopId)
  if (existing?.id) {
    await prisma.subscription.update({
      where: { barbershopId },
      data: { asaasCustomerId: existing.id },
    })
    return existing.id
  }

  const customer = await createAsaasCustomer({
    name: sub.barbershop.name,
    email: sub.barbershop.email,
    mobilePhone: sub.barbershop.phone,
    externalReference: barbershopId,
  })

  await prisma.subscription.update({
    where: { barbershopId },
    data: { asaasCustomerId: customer.id },
  })
  return customer.id
}

export type CheckoutResult = {
  asaasSubscriptionId: string
  paymentUrl: string | null
  pixQrCode?: string | null
  pixCopyPaste?: string | null
}

export async function startSubscriptionCheckout(
  barbershopId: string,
  plan: SubscriptionPlan,
  billingType: AsaasBillingType
): Promise<CheckoutResult> {
  if (!(await isBillingEnabled())) {
    throw new Error("Pagamentos via Asaas não estão ativos. Ative em Configurações da plataforma.")
  }

  const catalog = await getPlanCatalog()
  const price = catalog.plans[plan].price
  const customerId = await ensureAsaasCustomer(barbershopId)
  const nextDue = formatDateYmd(addMonths(new Date(), 1))
  const description = `Trim Time — ${catalog.plans[plan].name}`

  const current = await prisma.subscription.findUnique({ where: { barbershopId } })
  let asaasSubId = current?.asaasSubscriptionId

  if (asaasSubId) {
    await updateAsaasSubscription(asaasSubId, {
      value: price,
      billingType,
      updatePendingPayments: true,
    })
    await prisma.subscription.update({
      where: { barbershopId },
      data: { plan, billingType, status: "past_due" },
    })
  } else {
    const asaasSub = await createAsaasSubscription({
      customerId,
      billingType,
      value: price,
      nextDueDate: nextDue,
      description,
      externalReference: `${barbershopId}:${plan}`,
    })
    asaasSubId = asaasSub.id
    await prisma.subscription.update({
      where: { barbershopId },
      data: {
        plan,
        billingType,
        asaasSubscriptionId: asaasSubId,
        status: "past_due",
        trialEnd: null,
      },
    })
  }

  const payments = await listSubscriptionPayments(asaasSubId, "PENDING")
  const payment = payments[0]
  const paymentUrl = payment?.invoiceUrl || payment?.bankSlipUrl || null

  if (payment) {
    await prisma.payment.create({
      data: {
        barbershopId,
        provider: "asaas",
        externalId: payment.id,
        amount: payment.value,
        status: payment.status,
        plan,
        metadata: { billingType, subscriptionId: asaasSubId },
      },
    })
  }

  return {
    asaasSubscriptionId: asaasSubId,
    paymentUrl,
    pixQrCode: payment?.pixTransaction?.encodedImage ?? null,
    pixCopyPaste: payment?.pixTransaction?.payload ?? null,
  }
}

export async function changeSubscriptionPlan(
  barbershopId: string,
  newPlan: SubscriptionPlan
): Promise<CheckoutResult | { ok: true; plan: SubscriptionPlan }> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")

  const price = await getPlanPrice(newPlan)

  if (sub.asaasSubscriptionId && (await isBillingEnabled())) {
    await updateAsaasSubscription(sub.asaasSubscriptionId, {
      value: price,
      updatePendingPayments: true,
    })
    await prisma.subscription.update({
      where: { barbershopId },
      data: { plan: newPlan },
    })
    const payments = await listSubscriptionPayments(sub.asaasSubscriptionId, "PENDING")
    const payment = payments[0]
    return {
      asaasSubscriptionId: sub.asaasSubscriptionId,
      paymentUrl: payment?.invoiceUrl || payment?.bankSlipUrl || null,
      pixQrCode: payment?.pixTransaction?.encodedImage ?? null,
      pixCopyPaste: payment?.pixTransaction?.payload ?? null,
    }
  }

  const nextPayment = addMonths(new Date(), 1)
  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      plan: newPlan,
      status: "active",
      trialEnd: null,
      nextPayment,
    },
  })
  return { ok: true, plan: newPlan }
}

export async function cancelBarbershopSubscription(barbershopId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")

  if (sub.asaasSubscriptionId && (await isBillingEnabled())) {
    await cancelAsaasSubscription(sub.asaasSubscriptionId)
  }

  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      status: "canceled",
      trialEnd: null,
      nextPayment: null,
      asaasSubscriptionId: null,
      billingType: null,
    },
  })
}

export function billingSuccessUrl(): string {
  return `${getAppBaseUrl()}/painel/assinatura?paid=1`
}

export function cardSetupSuccessUrl(): string {
  return `${getAppBaseUrl()}/painel/assinatura?card=1`
}

export type TrialCardSetupPrefill = {
  name: string
  email: string
  phone: string | null
  postalCode: string | null
  addressNumber: string | null
}

export async function getTrialCardSetupPrefill(
  barbershopId: string
): Promise<TrialCardSetupPrefill> {
  const bs = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { name: true, email: true, phone: true, settings: true },
  })
  if (!bs) throw new Error("Barbearia não encontrada")
  const settings = (bs.settings ?? {}) as { cep?: string; address?: string }
  const addressNumber =
    settings.address?.match(/\d+/)?.[0] ?? (settings.address ? "S/N" : null)
  return {
    name: bs.name,
    email: bs.email,
    phone: bs.phone,
    postalCode: settings.cep?.replace(/\D/g, "") || null,
    addressNumber,
  }
}

/** Garante assinatura Asaas com vencimento adiado (sem débito no trial). */
export async function ensureTrialAsaasSubscription(barbershopId: string): Promise<string> {
  if (!(await isBillingEnabled())) {
    throw new Error("Cadastro de cartão indisponível. Ative a API de pagamento.")
  }

  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub || sub.status !== "trial") {
    throw new Error("Período de teste não está ativo.")
  }
  if (sub.cardSetupAt) {
    throw new Error("Cartão já cadastrado.")
  }

  const catalog = await getPlanCatalog()
  const plan = sub.plan as SubscriptionPlan
  const price = catalog.plans[plan].price
  const customerId = await ensureAsaasCustomer(barbershopId)
  const description = `Trim Time — teste grátis (cartão para ${catalog.plans[plan].name})`

  if (sub.asaasSubscriptionId) return sub.asaasSubscriptionId

  const asaasSub = await createAsaasSubscription({
    customerId,
    billingType: "CREDIT_CARD",
    value: price,
    nextDueDate: deferredChargeDate(),
    description,
    externalReference: `${barbershopId}:card_setup`,
  })
  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      asaasSubscriptionId: asaasSub.id,
      billingType: "CREDIT_CARD",
    },
  })
  return asaasSub.id
}

export type InAppCardSetupResult = {
  asaasSubscriptionId: string
  creditCardLast4: string | null
  creditCardBrand: string | null
}

/**
 * Cadastro de cartão no trial dentro do Trim Time (tokenização + assinatura Asaas).
 */
export async function registerTrialCardInApp(
  barbershopId: string,
  payload: TrialCardSetupPayload,
  remoteIp: string
): Promise<InAppCardSetupResult> {
  const asaasSubId = await ensureTrialAsaasSubscription(barbershopId)
  const customerId = await ensureAsaasCustomer(barbershopId)

  const holder = payload.creditCardHolderInfo
  const phone =
    digitsOnly(holder.mobilePhone || "") ||
    digitsOnly(holder.phone || "") ||
    "11999999999"

  const creditCard = {
    holderName: payload.creditCard.holderName.trim(),
    number: normalizeCardNumber(payload.creditCard.number),
    expiryMonth: normalizeExpiryMonth(payload.creditCard.expiryMonth),
    expiryYear: normalizeExpiryYear(payload.creditCard.expiryYear),
    ccv: digitsOnly(payload.creditCard.ccv),
  }
  const creditCardHolderInfo = {
    name: holder.name.trim(),
    email: holder.email.trim(),
    cpfCnpj: digitsOnly(holder.cpfCnpj),
    postalCode: digitsOnly(holder.postalCode),
    addressNumber: holder.addressNumber.trim() || "S/N",
    addressComplement: holder.addressComplement?.trim() || undefined,
    phone,
    mobilePhone: holder.mobilePhone ? digitsOnly(holder.mobilePhone) : undefined,
  }

  const token = await tokenizeAsaasCreditCard({
    customerId,
    creditCard,
    creditCardHolderInfo,
    remoteIp,
  })

  await updateAsaasSubscriptionCreditCard(asaasSubId, {
    creditCardToken: token.creditCardToken,
    remoteIp,
  })

  await markCardSetupComplete(barbershopId)

  return {
    asaasSubscriptionId: asaasSubId,
    creditCardLast4: token.creditCardNumber ?? null,
    creditCardBrand: token.creditCardBrand ?? null,
  }
}

/**
 * @deprecated Fluxo legado — redireciona para fatura Asaas. Preferir registerTrialCardInApp.
 */
export async function startTrialCardSetup(barbershopId: string): Promise<CheckoutResult> {
  const asaasSubId = await ensureTrialAsaasSubscription(barbershopId)
  const payments = await listSubscriptionPayments(asaasSubId, "PENDING")
  const payment = payments[0]

  return {
    asaasSubscriptionId: asaasSubId,
    paymentUrl: payment?.invoiceUrl || payment?.bankSlipUrl || null,
    pixQrCode: null,
    pixCopyPaste: null,
  }
}

export async function markCardSetupComplete(barbershopId: string): Promise<void> {
  await prisma.subscription.update({
    where: { barbershopId },
    data: { cardSetupAt: new Date() },
  })
}

/** Cliente aceita contratar após os 7 dias — aí sim agenda a cobrança. */
export async function acceptTrialAndSubscribe(
  barbershopId: string,
  plan: SubscriptionPlan
): Promise<CheckoutResult | { ok: true }> {
  return subscribeAfterTrialDecision(barbershopId, plan, false)
}

/** Durante os dias grátis: optar por cobrança já (primeira fatura na data atual). */
export async function startPaidSubscriptionEarly(
  barbershopId: string,
  plan: SubscriptionPlan
): Promise<CheckoutResult> {
  return subscribeAfterTrialDecision(barbershopId, plan, true) as Promise<CheckoutResult>
}

async function subscribeAfterTrialDecision(
  barbershopId: string,
  plan: SubscriptionPlan,
  chargeImmediately: boolean
): Promise<CheckoutResult | { ok: true }> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")
  if (!sub.cardSetupAt) {
    throw new Error("Cadastre o cartão antes de contratar.")
  }

  if (chargeImmediately) {
    const trialActive =
      sub.status === "trial" &&
      !!sub.trialEnd &&
      new Date(sub.trialEnd) > new Date()
    if (!trialActive) {
      throw new Error(
        "Cobrar agora só está disponível durante os dias grátis. Depois, use a opção no fim do teste."
      )
    }
  }

  const price = await getPlanPrice(plan)
  const nextDue = chargeImmediately
    ? formatDateYmd(new Date())
    : formatDateYmd(addDays(new Date(), 1))
  const nextPayment = addMonths(new Date(), 1)

  if (sub.asaasSubscriptionId && (await isBillingEnabled())) {
    await updateAsaasSubscription(sub.asaasSubscriptionId, {
      value: price,
      billingType: "CREDIT_CARD",
      nextDueDate: nextDue,
      updatePendingPayments: true,
    })
    const payments = await listSubscriptionPayments(sub.asaasSubscriptionId, "PENDING")
    const payment = payments[0]
    await prisma.subscription.update({
      where: { barbershopId },
      data: {
        plan,
        status: chargeImmediately ? "past_due" : "active",
        postTrialChoice: "accepted",
        trialEnd: null,
        nextPayment: chargeImmediately ? null : nextPayment,
      },
    })
    return {
      asaasSubscriptionId: sub.asaasSubscriptionId,
      paymentUrl: payment?.invoiceUrl || null,
      pixQrCode: null,
      pixCopyPaste: null,
    }
  }

  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      plan,
      status: "active",
      postTrialChoice: "accepted",
      trialEnd: null,
      nextPayment,
    },
  })
  return { ok: true }
}

/** Cliente recusa contratar — cancela no Asaas sem cobrar. */
export async function declineTrialSubscription(barbershopId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")

  if (sub.asaasSubscriptionId && (await isBillingEnabled())) {
    try {
      await cancelAsaasSubscription(sub.asaasSubscriptionId)
    } catch (e) {
      console.error("[billing] decline cancel asaas", e)
    }
  }

  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      status: "canceled",
      postTrialChoice: "declined",
      trialEnd: null,
      nextPayment: null,
      asaasSubscriptionId: null,
      billingType: null,
      graceAccessUntil: createGraceAccessUntilDate(),
    },
  })
}
