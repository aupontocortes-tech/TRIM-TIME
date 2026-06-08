import { refundAsaasPayment } from "@/lib/asaas/client"
import { isBillingEnabled } from "@/lib/asaas/billing-service"
import { prisma } from "@/lib/prisma"

const REFUNDABLE_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
])

export async function refundBarbershopPayment(params: {
  paymentId: string
  adminBarbershopId: string
  description?: string
  value?: number
}): Promise<{ ok: true; refundStatus: string }> {
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
  if (!REFUNDABLE_STATUSES.has(row.status)) {
    throw new Error(`Status "${row.status}" não permite estorno pelo app.`)
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

  return { ok: true, refundStatus: refund.status }
}
