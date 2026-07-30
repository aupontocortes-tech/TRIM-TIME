import type { PlanCatalog } from "@/lib/plan-catalog"
import type { SubscriptionPlan, SubscriptionStatus, Subscription } from "@/lib/db/types"
import { formatPlanPrice, formatPlanPricePerMonth } from "@/lib/format-plan-price"
import { daysLeftInTrial, isTrialActive } from "@/lib/subscription"

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Período de teste",
  active: "Assinatura ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
}

const BILLING_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  PIX: "PIX",
}

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  diners: "Diners Club",
}

export type BillingAccountSummary = {
  plan: SubscriptionPlan | null
  plan_name: string
  plan_price: number
  monthly_amount_text: string
  status: SubscriptionStatus
  status_label: string
  billing_type: string | null
  billing_type_label: string | null
  card_last4: string | null
  card_brand: string | null
  card_display: string | null
  card_registered: boolean
  trial_active: boolean
  trial_days_left: number
  next_charge_date: string | null
  next_charge_date_raw: string | null
  billing_day_of_month: number | null
  billing_cycle_text: string
  features_included_hint: string | null
}

export type BuildBillingAccountSummaryInput = {
  subscription: {
    plan: SubscriptionPlan
    status: SubscriptionStatus
    trial_end: string | null
    next_payment: string | null
    card_setup_at?: string | null
    billing_type?: string | null
    credit_card_last4?: string | null
    credit_card_brand?: string | null
  } | null
  effectivePlan: SubscriptionPlan | null
  catalog: PlanCatalog | null
}

function normalizeCardLast4(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 4) return digits.slice(-4)
  return null
}

export function formatCardBrand(brand: string | null | undefined): string | null {
  if (!brand?.trim()) return null
  const key = brand.trim().toLowerCase()
  return CARD_BRAND_LABELS[key] ?? brand.trim()
}

function formatPtBrDate(iso: string | Date | null | undefined): string | null {
  if (!iso) return null
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (!Number.isFinite(d.getTime())) return null
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function dayOfMonthFromIso(iso: string | Date | null | undefined): number | null {
  if (!iso) return null
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (!Number.isFinite(d.getTime())) return null
  const day = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "numeric",
    }).format(d)
  )
  return Number.isFinite(day) ? day : null
}

function buildBillingCycleText(params: {
  status: SubscriptionStatus
  trialActive: boolean
  trialDaysLeft: number
  billingType: string | null
  cardRegistered: boolean
  billingDay: number | null
  nextChargeFormatted: string | null
  monthlyAmount: string
}): string {
  const { status, trialActive, billingType, cardRegistered, billingDay, nextChargeFormatted, monthlyAmount } =
    params

  if (status === "canceled") {
    return "Sua assinatura está cancelada. Contrate um plano novamente para reativar o acesso completo."
  }

  if (billingType === "PIX") {
    return "A mensalidade é paga via PIX. Todo mês você receberá um novo código de pagamento por e-mail ou aqui no painel."
  }

  if (trialActive && cardRegistered && nextChargeFormatted) {
    const dayPart =
      billingDay != null
        ? ` Todo mês a cobrança será feita no dia ${billingDay}.`
        : ""
    return `Você está no período de teste. A primeira cobrança de ${monthlyAmount} será em ${nextChargeFormatted}, salvo se cancelar antes.${dayPart}`
  }

  if (status === "active" && cardRegistered && billingDay != null) {
    return `Sua mensalidade de ${monthlyAmount} é debitada automaticamente todo dia ${billingDay} de cada mês no cartão cadastrado.`
  }

  if (status === "past_due") {
    return "Identificamos um pagamento pendente. Regularize para manter seu plano ativo sem interrupções."
  }

  if (cardRegistered && nextChargeFormatted) {
    return `Próxima cobrança prevista para ${nextChargeFormatted}.`
  }

  if (!cardRegistered) {
    return "Cadastre um cartão para ativar a cobrança automática da mensalidade."
  }

  return "Os detalhes da cobrança serão exibidos após a confirmação do pagamento."
}

export function buildBillingAccountSummary(
  input: BuildBillingAccountSummaryInput
): BillingAccountSummary | null {
  const { subscription, effectivePlan, catalog } = input
  if (!subscription || !effectivePlan || !catalog) return null

  const planMeta = catalog.plans[effectivePlan]
  const status = subscription.status
  const trialActive = isTrialActive(subscription as Subscription)
  const trialDaysLeft = daysLeftInTrial(subscription as Subscription)
  const billingType = subscription.billing_type ?? null
  const cardLast4 = normalizeCardLast4(subscription.credit_card_last4)
  const cardBrand = formatCardBrand(subscription.credit_card_brand)
  const cardRegistered = !!subscription.card_setup_at
  const cardDisplay =
    cardLast4 != null
      ? `${cardBrand ? `${cardBrand} ` : ""}•••• ${cardLast4}`
      : cardRegistered
        ? "Cartão cadastrado"
        : null

  const nextChargeRaw = trialActive
    ? subscription.trial_end
    : subscription.next_payment ?? subscription.trial_end
  const nextChargeFormatted = formatPtBrDate(nextChargeRaw)
  const billingDay =
    dayOfMonthFromIso(nextChargeRaw) ??
    dayOfMonthFromIso(subscription.next_payment) ??
    dayOfMonthFromIso(subscription.card_setup_at)

  const monthlyAmount = formatPlanPricePerMonth(planMeta.price)

  return {
    plan: effectivePlan,
    plan_name: planMeta.name,
    plan_price: planMeta.price,
    monthly_amount_text: formatPlanPrice(planMeta.price),
    status,
    status_label: STATUS_LABELS[status],
    billing_type: billingType,
    billing_type_label: billingType ? (BILLING_TYPE_LABELS[billingType] ?? billingType) : null,
    card_last4: cardLast4,
    card_brand: cardBrand,
    card_display: cardDisplay,
    card_registered: cardRegistered,
    trial_active: trialActive,
    trial_days_left: trialDaysLeft,
    next_charge_date: nextChargeFormatted,
    next_charge_date_raw: nextChargeRaw,
    billing_day_of_month: billingDay,
    billing_cycle_text: buildBillingCycleText({
      status,
      trialActive,
      trialDaysLeft,
      billingType,
      cardRegistered,
      billingDay,
      nextChargeFormatted,
      monthlyAmount,
    }),
    features_included_hint: `Plano ${planMeta.name} — ${monthlyAmount}`,
  }
}

export const BILLING_CLIENT_MESSAGES = {
  paymentConfirmed:
    "Pagamento confirmado com sucesso. Sua assinatura está ativa e você já pode utilizar todos os recursos do plano contratado.",
  cardRegistered:
    "Cartão cadastrado com sucesso. Sua assinatura está configurada para cobrança automática mensal.",
  planUpdated: "Plano alterado com sucesso. A próxima fatura refletirá o novo valor contratado.",
  checkoutProcessing:
    "Pagamento enviado para processamento. Assim que confirmado, seu plano será ativado automaticamente.",
  checkoutConfirmed: "Compra efetuada com sucesso. Sua assinatura está ativa.",
  trialDeclined: "Você optou por não continuar. Nenhuma cobrança foi realizada.",
  trialCanceled: "Período de teste cancelado. Nenhuma cobrança será realizada no seu cartão.",
  subscriptionCanceled: "Assinatura cancelada. Você não receberá novas cobranças.",
  cardUpdated: "Cartão de pagamento atualizado com sucesso.",
} as const
