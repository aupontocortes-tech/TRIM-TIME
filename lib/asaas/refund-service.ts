import {
  refundAsaasPayment,
  getAsaasPayment,
  undoAsaasReceivedInCash,
  AsaasApiError,
  type AsaasPayment,
} from "@/lib/asaas/client"
import { isAsaasSandboxApi } from "@/lib/asaas/config"
import { isBillingEnabled } from "@/lib/asaas/billing-service"
import { tryAutoConfirmSandboxCreditCardPayment } from "@/lib/asaas/sandbox-payment-sync"
import { prisma } from "@/lib/prisma"

/** Status no Trim Time (webhook / registro local). */
const REFUNDABLE_LOCAL_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
])

function normalizePaymentStatus(status: string): string {
  return status.trim().toUpperCase()
}

function billingTypeOf(payment: AsaasPayment): string {
  return (payment.billingType ?? "").trim().toUpperCase()
}

function isCardBilling(billingType?: string | null): boolean {
  const bt = (billingType ?? "").trim().toUpperCase()
  return bt === "CREDIT_CARD" || bt === "DEBIT_CARD"
}

/** Status que a API de estorno do Asaas aceita de fato (varia por forma de pagamento). */
export function canRefundAsaasPayment(payment: AsaasPayment): boolean {
  const status = normalizePaymentStatus(payment.status)
  const billing = billingTypeOf(payment)
  const isCard = isCardBilling(billing) || !!payment.subscription

  if (isCard) {
    return status === "CONFIRMED" || status === "RECEIVED"
  }

  return (
    status === "CONFIRMED" ||
    status === "RECEIVED" ||
    status === "RECEIVED_IN_CASH"
  )
}

function isRefundableByAsaasApi(payment: AsaasPayment): boolean {
  return canRefundAsaasPayment(payment)
}

function isRefundableStatusError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("confirmadas ou recebidas") || m.includes("confirmed or received")
}

function asaasEnvLabel(): string {
  return isAsaasSandboxApi() ? "sandbox (sandbox.asaas.com)" : "produção (api.asaas.com)"
}

function refundBlockedMessage(payment: AsaasPayment, externalId: string): string {
  const status = payment.status
  const billing = billingTypeOf(payment) || "?"
  const statusNorm = normalizePaymentStatus(status)

  if (
    (isCardBilling(billing) || !!payment.subscription) &&
    statusNorm === "RECEIVED_IN_CASH"
  ) {
    return (
      `A cobrança ${externalId} é de cartão, mas no Asaas está como "recebida em dinheiro" ` +
      `(RECEIVED_IN_CASH). Isso impede estorno pela API. O app tentou corrigir automaticamente; ` +
      "se ainda falhou, estorne pelo painel sandbox.asaas.com ou crie uma nova cobrança de teste."
    )
  }

  if (statusNorm === "PENDING" && isAsaasSandboxApi()) {
    return (
      `No Asaas sandbox a cobrança ${externalId} está PENDENTE. ` +
      "Só dá para estornar cobrança PAGA (confirmada no Asaas). " +
      "Esta ainda não foi paga — cancele no painel Asaas ou ignore. " +
      "Para testar estorno, use a linha com status Pago (confirmada)."
    )
  }

  return (
    `No Asaas (${asaasEnvLabel()}) a cobrança ${externalId} está "${status}" (forma: ${billing}). ` +
    "Só dá para estornar cobranças confirmadas ou recebidas pelo meio original (cartão/PIX). " +
    "Confira se ASAAS_ENVIRONMENT e ASAAS_API_KEY na Vercel são do mesmo ambiente em que você pagou."
  )
}

async function tryConfirmSandboxPayment(externalId: string): Promise<AsaasPayment | null> {
  return tryAutoConfirmSandboxCreditCardPayment(externalId, "CREDIT_CARD")
}

/** Cartão marcado como "recebido em dinheiro" no painel Asaas — normaliza antes do estorno. */
async function normalizePaymentForRefund(payment: AsaasPayment, externalId: string): Promise<AsaasPayment> {
  const billing = billingTypeOf(payment)
  const status = normalizePaymentStatus(payment.status)

  if (
    (isCardBilling(billing) || payment.subscription) &&
    status === "RECEIVED_IN_CASH"
  ) {
    try {
      payment = await undoAsaasReceivedInCash(externalId)
    } catch (e) {
      console.warn("[refund] undoReceivedInCash failed", externalId, e)
    }

    const confirmed = await tryConfirmSandboxPayment(externalId)
    if (confirmed) return confirmed

    return await getAsaasPayment(externalId)
  }

  return payment
}

async function resolveRefundableAsaasPayment(externalId: string): Promise<AsaasPayment> {
  let payment = await getAsaasPayment(externalId)
  payment = await normalizePaymentForRefund(payment, externalId)

  if (isRefundableByAsaasApi(payment)) return payment

  const confirmed = await tryConfirmSandboxPayment(externalId)
  if (confirmed && isRefundableByAsaasApi(confirmed)) return confirmed

  payment = await getAsaasPayment(externalId)
  payment = await normalizePaymentForRefund(payment, externalId)
  if (isRefundableByAsaasApi(payment)) return payment

  throw new Error(refundBlockedMessage(payment, externalId))
}

async function requestAsaasRefund(
  externalId: string,
  input: { value?: number; description?: string }
) {
  try {
    return await refundAsaasPayment(externalId, input)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!isRefundableStatusError(msg)) throw e

    let payment = await getAsaasPayment(externalId)
    payment = await normalizePaymentForRefund(payment, externalId)

    if (isRefundableByAsaasApi(payment)) {
      return await refundAsaasPayment(externalId, input)
    }

    const confirmed = await tryConfirmSandboxPayment(externalId)
    if (confirmed && isRefundableByAsaasApi(confirmed)) {
      return await refundAsaasPayment(externalId, input)
    }

    const latest = await getAsaasPayment(externalId).catch(() => null)
    if (latest) {
      throw new Error(refundBlockedMessage(latest, externalId))
    }
    throw e
  }
}

/** Consulta status real no Asaas (para exibir no modal de estorno). */
export async function getAsaasPaymentRefundPreview(externalId: string | null): Promise<{
  asaas_id: string | null
  asaas_status: string | null
  billing_type: string | null
  environment: string
  error: string | null
  warning: string | null
}> {
  const environment = asaasEnvLabel()
  if (!externalId) {
    return {
      asaas_id: null,
      asaas_status: null,
      billing_type: null,
      environment,
      error: "Cobrança sem ID no Asaas.",
      warning: null,
    }
  }
  try {
    const payment = await getAsaasPayment(externalId)
    const billing = billingTypeOf(payment)
    const status = normalizePaymentStatus(payment.status)
    const isCard = isCardBilling(billing) || !!payment.subscription
    const warning =
      isCard && status === "RECEIVED_IN_CASH"
        ? "Cartão marcado como recebido em dinheiro no Asaas — o estorno vai tentar corrigir isso automaticamente."
        : status === "PENDING" && isAsaasSandboxApi()
          ? "Pendente no Asaas — só dá para estornar cobrança confirmada. Use a linha com status Pago ou faça nova compra de teste."
          : null

    return {
      asaas_id: payment.id,
      asaas_status: payment.status,
      billing_type: payment.billingType ?? null,
      environment,
      error: null,
      warning,
    }
  } catch (e) {
    const msg = e instanceof AsaasApiError ? e.message : e instanceof Error ? e.message : "Erro ao consultar Asaas"
    return {
      asaas_id: externalId,
      asaas_status: null,
      billing_type: null,
      environment,
      error: `${msg} Verifique ASAAS_ENVIRONMENT e ASAAS_API_KEY na Vercel.`,
      warning: null,
    }
  }
}

export async function refundBarbershopPayment(params: {
  paymentId: string
  adminBarbershopId: string
  description?: string
  value?: number
}): Promise<{ ok: true; refundStatus: string; asaasStatus: string }> {
  if (!(await isBillingEnabled())) {
    throw new Error("Cobrança online não está ativa.")
  }

  const row = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    include: { barbershop: { select: { name: true } } },
  })
  if (!row) throw new Error("Cobrança não encontrada.")
  if (!row.externalId) throw new Error("Cobrança sem ID no Asaas — estorne pelo painel Asaas.")
  if (row.status === "REFUNDED") throw new Error("Esta cobrança já foi estornada.")
  if (!REFUNDABLE_LOCAL_STATUSES.has(normalizePaymentStatus(row.status))) {
    throw new Error(`Status "${row.status}" não permite estorno pelo app.`)
  }

  const asaasPayment = await resolveRefundableAsaasPayment(row.externalId)
  const asaasStatus = normalizePaymentStatus(asaasPayment.status)

  if (normalizePaymentStatus(row.status) !== asaasStatus) {
    await prisma.payment.update({
      where: { id: row.id },
      data: { status: asaasStatus },
    })
  }

  const amount = Number(row.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor da cobrança inválido.")
  }
  if (params.value != null) {
    const v = Number(params.value)
    if (!Number.isFinite(v) || v <= 0 || v > amount) {
      throw new Error("Valor de estorno inválido.")
    }
  }

  const reason =
    params.description?.trim() ||
    `Estorno Trim Time — ${row.barbershop.name}`

  const refund = await requestAsaasRefund(row.externalId, {
    value: params.value,
    description: reason,
  })

  const prevMeta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  await prisma.payment.update({
    where: { id: row.id },
    data: {
      status: "REFUNDED",
      metadata: {
        ...prevMeta,
        refunded_at: new Date().toISOString(),
        refunded_by: params.adminBarbershopId,
        refund_reason: reason,
        asaas_refund_status: refund.status,
        asaas_status_at_refund: asaasPayment.status,
      },
    },
  })

  return { ok: true, refundStatus: refund.status, asaasStatus: asaasPayment.status }
}
