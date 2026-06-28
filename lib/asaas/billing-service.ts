import type { SubscriptionPlan } from "@/lib/db/types"
import type { SignupBillingMode } from "@/lib/billing/signup-mode"
import type { TrialCardSetupPayload } from "@/lib/asaas/card-types"
import {
  digitsOnly,
  normalizeCardNumber,
  normalizeExpiryMonth,
  normalizeExpiryYear,
} from "@/lib/asaas/card-types"
import {
  cancelAsaasSubscription,
  cancelPixAutomaticAuthorization,
  createAsaasCustomer,
  createAsaasPayment,
  createAsaasSubscription,
  deleteAsaasPayment,
  findAsaasCustomerByReference,
  getAsaasPayment,
  listAllSubscriptionPayments,
  listAsaasSubscriptionsByCustomer,
  listOpenAsaasPaymentsByCustomer,
  listSubscriptionPayments,
  tokenizeAsaasCreditCard,
  updateAsaasSubscription,
  updateAsaasSubscriptionCreditCard,
  type AsaasBillingType,
  type AsaasPayment,
} from "@/lib/asaas/client"
import { computePlanChangeBilling } from "@/lib/billing/plan-change-proration"
import { getAppBaseUrl, isAsaasConfigured } from "@/lib/asaas/config"
import {
  autoConfirmAndSyncSubscriptionPayment,
  autoConfirmPendingSubscriptionPayments,
  syncBarbershopPendingPayments,
  waitForSubscriptionPendingPayment,
} from "@/lib/asaas/sandbox-payment-sync"
import { getPlanCatalog, getPlanPrice } from "@/lib/plan-catalog"
import { onBarbershopPlanChanged } from "@/lib/barbershop-units-plan"
import { isPaymentApiActive } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
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
  proration?: { mode: string; amount: number }
}

async function upsertLocalAsaasPayment(params: {
  barbershopId: string
  payment: { id: string; value: number; status: string }
  plan: SubscriptionPlan
  billingType: AsaasBillingType
  asaasSubscriptionId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const meta = {
    billingType: params.billingType,
    subscriptionId: params.asaasSubscriptionId,
    ...params.metadata,
  } as Prisma.InputJsonValue

  const existing = await prisma.payment.findFirst({
    where: { provider: "asaas", externalId: params.payment.id },
  })

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: params.payment.status,
        amount: params.payment.value,
        plan: params.plan,
        metadata: meta,
      },
    })
    return
  }

  await prisma.payment.create({
    data: {
      barbershopId: params.barbershopId,
      provider: "asaas",
      externalId: params.payment.id,
      amount: params.payment.value,
      status: params.payment.status,
      plan: params.plan,
      metadata: meta,
    },
  })
}

function isOpenAsaasChargeStatus(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === "PENDING" || s === "OVERDUE" || s === "AWAITING_RISK_ANALYSIS"
}

function isPaidAsaasStatus(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === "CONFIRMED" || s === "RECEIVED" || s === "RECEIVED_IN_CASH"
}

async function deleteAllOpenSubscriptionPayments(asaasSubId: string): Promise<void> {
  const payments = await listAllSubscriptionPayments(asaasSubId, "30")
  for (const p of payments) {
    if (!p.id || !isOpenAsaasChargeStatus(p.status ?? "")) continue
    try {
      await deleteAsaasPayment(p.id)
    } catch (e) {
      console.warn("[billing] delete open subscription payment", p.id, e)
    }
  }
}

async function deleteOtherOpenCustomerPayments(
  customerId: string,
  keepPaymentId: string
): Promise<void> {
  try {
    const open = await listOpenAsaasPaymentsByCustomer(customerId)
    for (const p of open) {
      if (!p.id || p.id === keepPaymentId || !isOpenAsaasChargeStatus(p.status ?? "")) continue
      await deleteAsaasPayment(p.id).catch((e) => {
        console.warn("[billing] delete duplicate open payment", p.id, e)
      })
    }
  } catch (e) {
    console.warn("[billing] cleanup duplicate customer payments", customerId, e)
  }
}

/** Cancela assinaturas antigas e cobranças abertas antes de contratação imediata limpa. */
async function resetAsaasCustomerForImmediateSignup(
  customerId: string,
  barbershopId: string
): Promise<void> {
  try {
    const subs = await listAsaasSubscriptionsByCustomer(customerId)
    for (const s of subs) {
      if (!s.id) continue
      await deleteAllOpenSubscriptionPayments(s.id)
      await cancelAsaasSubscription(s.id).catch((e) => {
        console.warn("[billing/immediate] cancel old subscription", s.id, e)
      })
    }
  } catch (e) {
    console.warn("[billing/immediate] list/cancel subscriptions", barbershopId, e)
  }

  try {
    const open = await listOpenAsaasPaymentsByCustomer(customerId)
    for (const p of open) {
      if (!p.id || !isOpenAsaasChargeStatus(p.status ?? "")) continue
      await deleteAsaasPayment(p.id).catch(() => {})
    }
  } catch (e) {
    console.warn("[billing/immediate] delete open customer payments", barbershopId, e)
  }

  await prisma.subscription.update({
    where: { barbershopId },
    data: { asaasSubscriptionId: null },
  })
}

/** Garante cobrança aberta na assinatura (cria no Asaas se a API não gerar sozinha). */
async function resolveOrCreateSubscriptionPayment(params: {
  barbershopId: string
  customerId: string
  asaasSubId: string
  plan: SubscriptionPlan
  billingType: AsaasBillingType
  price: number
  description: string
  /** Apaga cobranças abertas antigas e cria uma com vencimento hoje (contratação imediata). */
  forceDueToday?: boolean
}): Promise<AsaasPayment> {
  const today = formatDateYmd(new Date())

  if (params.forceDueToday) {
    await deleteAllOpenSubscriptionPayments(params.asaasSubId)
  }

  await new Promise((r) => setTimeout(r, params.forceDueToday ? 1000 : 1200))

  let payment: AsaasPayment | null = null

  if (params.forceDueToday) {
    payment = await waitForSubscriptionPendingPayment(params.asaasSubId, 12)
    if (payment && payment.dueDate !== today) {
      await deleteAsaasPayment(payment.id).catch(() => {})
      payment = null
    }
  } else {
    payment =
      (await waitForSubscriptionPendingPayment(params.asaasSubId, 15)) ??
      (await listSubscriptionPayments(params.asaasSubId, "OVERDUE"))[0] ??
      null
  }

  if (!payment) {
    const recent = await listAllSubscriptionPayments(params.asaasSubId, "10")
    payment =
      recent.find(
        (p) =>
          isOpenAsaasChargeStatus(p.status ?? "") &&
          (!params.forceDueToday || p.dueDate === today)
      ) ?? null
  }

  if (!payment) {
    if (params.forceDueToday) {
      payment = await waitForSubscriptionPendingPayment(params.asaasSubId, 8)
      if (payment && payment.dueDate !== today) {
        await deleteAsaasPayment(payment.id).catch(() => {})
        payment = null
      }
    }
  }

  if (!payment) {
    payment = await createAsaasPayment({
      customerId: params.customerId,
      billingType: params.billingType,
      value: params.price,
      dueDate: today,
      description: params.description,
      externalReference: `${params.barbershopId}:checkout:${params.plan}`,
      subscriptionId: params.asaasSubId,
    })
  }

  if (params.forceDueToday && payment.id) {
    const recent = await listAllSubscriptionPayments(params.asaasSubId, "15")
    for (const p of recent) {
      if (!p.id || p.id === payment!.id || !isOpenAsaasChargeStatus(p.status ?? "")) continue
      await deleteAsaasPayment(p.id).catch(() => {})
    }
  }

  return payment
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
  /** Cobrança imediata — vencimento hoje (não daqui a 1 mês). */
  const nextDue = formatDateYmd(new Date())
  const description = `Trim Time — ${catalog.plans[plan].name}`

  const current = await prisma.subscription.findUnique({ where: { barbershopId } })
  let asaasSubId = current?.asaasSubscriptionId

  if (asaasSubId) {
    await updateAsaasSubscription(asaasSubId, {
      value: price,
      billingType,
      nextDueDate: nextDue,
      updatePendingPayments: true,
    })
    await prisma.subscription.update({
      where: { barbershopId },
      data: { plan, billingType, status: "past_due" },
    })
    await onBarbershopPlanChanged(barbershopId, plan)
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
    await onBarbershopPlanChanged(barbershopId, plan)
  }

  const payment = await resolveOrCreateSubscriptionPayment({
    barbershopId,
    customerId,
    asaasSubId,
    plan,
    billingType,
    price,
    description,
  })
  const paymentUrl = payment.invoiceUrl || payment.bankSlipUrl || null

  await upsertLocalAsaasPayment({
    barbershopId,
    payment,
    plan,
    billingType,
    asaasSubscriptionId: asaasSubId,
  })

  if (billingType === "CREDIT_CARD") {
    await autoConfirmAndSyncSubscriptionPayment({
      barbershopId,
      paymentId: payment.id,
      plan,
      asaasSubscriptionId: asaasSubId,
      billingType,
    })
    await syncBarbershopPendingPayments(barbershopId)
  }

  return {
    asaasSubscriptionId: asaasSubId,
    paymentUrl,
    pixQrCode: payment.pixTransaction?.encodedImage ?? null,
    pixCopyPaste: payment.pixTransaction?.payload ?? null,
  }
}

export async function changeSubscriptionPlan(
  barbershopId: string,
  newPlan: SubscriptionPlan
): Promise<
  CheckoutResult | { ok: true; plan: SubscriptionPlan; proration?: { mode: string; amount: number } }
> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")

  const currentPlan = sub.plan as SubscriptionPlan
  if (currentPlan === newPlan) {
    return { ok: true, plan: newPlan }
  }

  if (sub.asaasSubscriptionId && (await isBillingEnabled())) {
    const billing = await computePlanChangeBilling(barbershopId, currentPlan, newPlan)
    const catalog = await getPlanCatalog()

    await updateAsaasSubscription(sub.asaasSubscriptionId, {
      value: billing.nextSubscriptionValue,
      updatePendingPayments: billing.updatePendingPayments,
    })

    await prisma.subscription.update({
      where: { barbershopId },
      data: { plan: newPlan },
    })
    await onBarbershopPlanChanged(barbershopId, newPlan)

    const billingType = (sub.billingType ?? "CREDIT_CARD") as AsaasBillingType
    let paymentUrl: string | null = null

    if (billing.chargeMode === "difference" && billing.chargeAmount > 0) {
      const pending = await listSubscriptionPayments(sub.asaasSubscriptionId, "PENDING")
      for (const p of pending) {
        await deleteAsaasPayment(p.id).catch((e) => {
          console.warn("[billing/plan] delete pending payment", p.id, e)
        })
        await prisma.payment.deleteMany({
          where: { provider: "asaas", externalId: p.id },
        })
      }

      const customerId = sub.asaasCustomerId ?? (await ensureAsaasCustomer(barbershopId))
      const diffPayment = await createAsaasPayment({
        customerId,
        billingType,
        value: billing.chargeAmount,
        dueDate: formatDateYmd(new Date()),
        description: `Trim Time — upgrade ${catalog.plans[currentPlan].name} → ${catalog.plans[newPlan].name} (diferença)`,
        externalReference: `${barbershopId}:upgrade:${newPlan}`,
        subscriptionId: sub.asaasSubscriptionId,
      })

      await prisma.payment.create({
        data: {
          barbershopId,
          provider: "asaas",
          externalId: diffPayment.id,
          amount: diffPayment.value,
          status: diffPayment.status,
          plan: newPlan,
          metadata: {
            billingType,
            subscriptionId: sub.asaasSubscriptionId,
            proration: true,
            fromPlan: currentPlan,
            toPlan: newPlan,
            chargeMode: billing.chargeMode,
          } as Prisma.InputJsonValue,
        },
      })

      if (billingType === "CREDIT_CARD") {
        await autoConfirmAndSyncSubscriptionPayment({
          barbershopId,
          paymentId: diffPayment.id,
          plan: newPlan,
          asaasSubscriptionId: sub.asaasSubscriptionId,
          billingType,
        })
      }

      paymentUrl = diffPayment.invoiceUrl || diffPayment.bankSlipUrl || null

      return {
        asaasSubscriptionId: sub.asaasSubscriptionId,
        paymentUrl,
        pixQrCode: diffPayment.pixTransaction?.encodedImage ?? null,
        pixCopyPaste: diffPayment.pixTransaction?.payload ?? null,
        proration: { mode: billing.chargeMode, amount: billing.chargeAmount },
      }
    }

    if (billing.chargeMode === "full") {
      const customerId = sub.asaasCustomerId ?? (await ensureAsaasCustomer(barbershopId))
      await updateAsaasSubscription(sub.asaasSubscriptionId, {
        value: billing.nextSubscriptionValue,
        billingType,
        nextDueDate: formatDateYmd(new Date()),
        updatePendingPayments: true,
      })

      const payment = await resolveOrCreateSubscriptionPayment({
        barbershopId,
        customerId,
        asaasSubId: sub.asaasSubscriptionId,
        plan: newPlan,
        billingType,
        price: billing.chargeAmount,
        description: `Trim Time — ${catalog.plans[newPlan].name}`,
      })

      await upsertLocalAsaasPayment({
        barbershopId,
        payment,
        plan: newPlan,
        billingType,
        asaasSubscriptionId: sub.asaasSubscriptionId,
        metadata: { chargeMode: billing.chargeMode },
      })

      if (billingType === "CREDIT_CARD") {
        await autoConfirmAndSyncSubscriptionPayment({
          barbershopId,
          paymentId: payment.id,
          plan: newPlan,
          asaasSubscriptionId: sub.asaasSubscriptionId,
          billingType,
        })
      }

      paymentUrl = payment.invoiceUrl || payment.bankSlipUrl || null
      return {
        asaasSubscriptionId: sub.asaasSubscriptionId,
        paymentUrl,
        pixQrCode: payment.pixTransaction?.encodedImage ?? null,
        pixCopyPaste: payment.pixTransaction?.payload ?? null,
        proration: { mode: billing.chargeMode, amount: billing.chargeAmount },
      }
    }

    return {
      ok: true,
      plan: newPlan,
      proration: { mode: billing.chargeMode, amount: billing.chargeAmount },
    }
  }

  throw new Error(
    "Pagamento online não está ativo. Ative a cobrança em Configurações da plataforma antes de alterar o plano."
  )
}

export async function cancelBarbershopSubscription(barbershopId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")

  if (await isBillingEnabled()) {
    if (sub.asaasPixAutomaticAuthId) {
      try {
        await cancelPixAutomaticAuthorization(sub.asaasPixAutomaticAuthId)
      } catch (e) {
        console.warn("[billing] Falha ao cancelar Pix Automático:", e)
      }
    }
    if (sub.asaasSubscriptionId) {
      await cancelAsaasSubscription(sub.asaasSubscriptionId)
    }
  }

  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      status: "canceled",
      trialEnd: null,
      nextPayment: null,
      asaasSubscriptionId: null,
      asaasPixAutomaticAuthId: null,
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

export type EnsureAsaasSubOptions = {
  mode: SignupBillingMode
  plan: SubscriptionPlan
  nextDueDate: string
  description: string
  externalReference: string
}

async function ensureAsaasSubscriptionForSignup(
  barbershopId: string,
  opts: EnsureAsaasSubOptions
): Promise<string> {
  if (!(await isBillingEnabled())) {
    throw new Error("Cadastro de cartão indisponível. Ative a API de pagamento.")
  }

  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")
  if (sub.cardSetupAt) throw new Error("Cartão já cadastrado.")

  if (opts.mode === "trial" && sub.status !== "trial") {
    throw new Error("Período de teste não está ativo.")
  }

  const catalog = await getPlanCatalog()
  const price = catalog.plans[opts.plan].price
  const customerId = await ensureAsaasCustomer(barbershopId)

  if (opts.mode === "immediate") {
    await resetAsaasCustomerForImmediateSignup(customerId, barbershopId)
  } else if (sub.asaasSubscriptionId) {
    await updateAsaasSubscription(sub.asaasSubscriptionId, {
      value: price,
      billingType: "CREDIT_CARD",
      nextDueDate: opts.nextDueDate,
      updatePendingPayments: true,
    })
    await prisma.subscription.update({
      where: { barbershopId },
      data: { plan: opts.plan, billingType: "CREDIT_CARD" },
    })
    await onBarbershopPlanChanged(barbershopId, opts.plan)
    return sub.asaasSubscriptionId
  }

  const asaasSub = await createAsaasSubscription({
    customerId,
    billingType: "CREDIT_CARD",
    value: price,
    nextDueDate: opts.nextDueDate,
    description: opts.description,
    externalReference: opts.externalReference,
  })
  await prisma.subscription.update({
    where: { barbershopId },
    data: {
      asaasSubscriptionId: asaasSub.id,
      billingType: "CREDIT_CARD",
      plan: opts.plan,
    },
  })
  await onBarbershopPlanChanged(barbershopId, opts.plan)
  return asaasSub.id
}

/** Garante assinatura Asaas com vencimento no fim do trial (cobrança automática). */
export async function ensureTrialAsaasSubscription(barbershopId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub?.trialEnd) throw new Error("Período de teste não encontrado.")
  const catalog = await getPlanCatalog()
  const plan = sub.plan as SubscriptionPlan
  return ensureAsaasSubscriptionForSignup(barbershopId, {
    mode: "trial",
    plan,
    nextDueDate: formatDateYmd(sub.trialEnd),
    description: `Trim Time — teste grátis (${catalog.plans[plan].name})`,
    externalReference: `${barbershopId}:trial_auto`,
  })
}

export type InAppCardSetupResult = {
  asaasSubscriptionId: string
  creditCardLast4: string | null
  creditCardBrand: string | null
  mode?: SignupBillingMode
  plan?: SubscriptionPlan
}

export type RegisterCardOptions = {
  mode: SignupBillingMode
  plan?: SubscriptionPlan
}

/**
 * Cadastro de cartão no app (tokenização + assinatura Asaas).
 * trial: cobrança automática na data trial_end; immediate: cobrança após cadastro.
 */
export async function registerCardInApp(
  barbershopId: string,
  payload: TrialCardSetupPayload,
  remoteIp: string,
  options: RegisterCardOptions
): Promise<InAppCardSetupResult> {
  const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
  if (!sub) throw new Error("Assinatura não encontrada")

  const catalog = await getPlanCatalog()
  const mode = options.mode
  const plan =
    mode === "immediate"
      ? (options.plan ?? sub.plan)
      : (sub.plan as SubscriptionPlan)

  let asaasSubId: string
  if (mode === "immediate") {
    asaasSubId = await ensureAsaasSubscriptionForSignup(barbershopId, {
      mode: "immediate",
      plan,
      nextDueDate: formatDateYmd(new Date()),
      description: `Trim Time — ${catalog.plans[plan].name}`,
      externalReference: `${barbershopId}:${plan}`,
    })
  } else {
    if (!sub.trialEnd) throw new Error("Data de fim do teste não definida.")
    asaasSubId = await ensureAsaasSubscriptionForSignup(barbershopId, {
      mode: "trial",
      plan,
      nextDueDate: formatDateYmd(sub.trialEnd),
      description: `Trim Time — teste grátis (${catalog.plans[plan].name})`,
      externalReference: `${barbershopId}:trial_auto`,
    })
  }

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

  if (mode === "trial") {
    await prisma.subscription.update({
      where: { barbershopId },
      data: {
        cardSetupAt: new Date(),
        postTrialChoice: "accepted",
        plan,
      },
    })
    await onBarbershopPlanChanged(barbershopId, plan)
  }

  if (mode === "immediate") {
    const today = formatDateYmd(new Date())
    const price = catalog.plans[plan].price
    const description = `Trim Time — ${catalog.plans[plan].name}`

    await updateAsaasSubscription(asaasSubId, {
      value: price,
      billingType: "CREDIT_CARD",
      nextDueDate: today,
      updatePendingPayments: true,
    })

    const payment = await resolveOrCreateSubscriptionPayment({
      barbershopId,
      customerId,
      asaasSubId,
      plan,
      billingType: "CREDIT_CARD",
      price,
      description,
      forceDueToday: true,
    })

    await upsertLocalAsaasPayment({
      barbershopId,
      payment,
      plan,
      billingType: "CREDIT_CARD",
      asaasSubscriptionId: asaasSubId,
    })

    const charged = await autoConfirmAndSyncSubscriptionPayment({
      barbershopId,
      paymentId: payment.id,
      plan,
      asaasSubscriptionId: asaasSubId,
      billingType: "CREDIT_CARD",
      creditCardToken: token.creditCardToken,
      remoteIp,
      creditCardHolderInfo,
    })

    await syncBarbershopPendingPayments(barbershopId)

    let finalPayment =
      charged ?? (await getAsaasPayment(payment.id).catch(() => null))

    for (let i = 0; i < 5 && finalPayment && !isPaidAsaasStatus(finalPayment.status); i++) {
      await new Promise((r) => setTimeout(r, 1500))
      finalPayment = await getAsaasPayment(payment.id).catch(() => finalPayment)
      if (finalPayment && isPaidAsaasStatus(finalPayment.status)) {
        await autoConfirmAndSyncSubscriptionPayment({
          barbershopId,
          paymentId: payment.id,
          plan,
          asaasSubscriptionId: asaasSubId,
          billingType: "CREDIT_CARD",
        })
        break
      }
    }

    if (finalPayment && isPaidAsaasStatus(finalPayment.status)) {
      await deleteOtherOpenCustomerPayments(customerId, payment.id)
    }

    if (!finalPayment || !isPaidAsaasStatus(finalPayment.status)) {
      const st = (finalPayment?.status ?? "PENDING").toUpperCase()
      if (st === "AWAITING_RISK_ANALYSIS") {
        throw new Error(
          "Cobrança em análise pelo operador do cartão. Cartões virtuais costumam ficar neste status — tente um cartão físico ou aguarde alguns minutos."
        )
      }
      throw new Error(
        `Cobrança de R$ ${price} não foi confirmada (status: ${finalPayment?.status ?? "PENDING"}). Verifique limite e dados do cartão, ou use cartão físico.`
      )
    }

    await prisma.subscription.update({
      where: { barbershopId },
      data: {
        cardSetupAt: new Date(),
        postTrialChoice: "accepted",
        plan,
        status: "active",
        trialEnd: null,
        nextPayment: addMonths(new Date(), 1),
      },
    })
    await onBarbershopPlanChanged(barbershopId, plan)
  }

  return {
    asaasSubscriptionId: asaasSubId,
    creditCardLast4: token.creditCardNumber ?? null,
    creditCardBrand: token.creditCardBrand ?? null,
    mode,
    plan,
  }
}

/** @deprecated Use registerCardInApp */
export async function registerTrialCardInApp(
  barbershopId: string,
  payload: TrialCardSetupPayload,
  remoteIp: string
): Promise<InAppCardSetupResult> {
  return registerCardInApp(barbershopId, payload, remoteIp, { mode: "trial" })
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
        status: "past_due",
        postTrialChoice: "accepted",
        trialEnd: null,
        nextPayment: chargeImmediately ? null : nextPayment,
      },
    })
    await onBarbershopPlanChanged(barbershopId, plan)
    if (chargeImmediately) {
      await autoConfirmPendingSubscriptionPayments({
        barbershopId,
        asaasSubscriptionId: sub.asaasSubscriptionId,
        plan,
        billingType: "CREDIT_CARD",
      })
    }
    return {
      asaasSubscriptionId: sub.asaasSubscriptionId,
      paymentUrl: payment?.invoiceUrl || null,
      pixQrCode: null,
      pixCopyPaste: null,
    }
  }

  throw new Error(
    "Pagamento online não está ativo. Ative a cobrança em Configurações da plataforma antes de contratar."
  )
}

/** Cancela teste grátis antes da cobrança automática (sem débito). */
export async function cancelTrialBeforeAutoCharge(barbershopId: string): Promise<void> {
  return declineTrialSubscription(barbershopId)
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
