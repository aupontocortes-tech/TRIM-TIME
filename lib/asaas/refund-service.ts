import { refundAsaasPayment, getAsaasPayment } from "@/lib/asaas/client"
import { isBillingEnabled } from "@/lib/asaas/billing-service"
import { prisma } from "@/lib/prisma"

/** Status no Trim Time (webhook / registro local). */
const REFUNDABLE_LOCAL_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
])

/** Status real no Asaas — fonte da verdade no estorno. */
const REFUNDABLE_ASAAS_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
])

function normalizePaymentStatus(status: string): string {
  return status.trim().toUpperCase()
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

  const asaasPayment = await getAsaasPayment(row.externalId)
  const asaasStatus = normalizePaymentStatus(asaasPayment.status)
  if (!REFUNDABLE_ASAAS_STATUSES.has(asaasStatus)) {
    throw new Error(
      `No Asaas esta cobrança está "${asaasPayment.status}". Só dá para estornar confirmada ou recebida. ` +
        "No sandbox, abra a cobrança no Asaas e use \"Receber pagamento\" se ainda estiver pendente."
    )
  }

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

  const refund = await refundAsaasPayment(row.externalId, {
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
      },
    },
  })

  return { ok: true, refundStatus: refund.status, asaasStatus }
}
