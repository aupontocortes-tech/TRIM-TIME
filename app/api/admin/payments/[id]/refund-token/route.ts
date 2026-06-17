import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { issueRefundConfirmToken } from "@/lib/admin-refund-confirm"
import { getAsaasPaymentRefundPreview } from "@/lib/asaas/refund-service"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Gera código de confirmação para estorno (copiar e colar no modal). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const row = await prisma.payment.findUnique({
      where: { id },
      select: { id: true, status: true, externalId: true },
    })
    if (!row) {
      return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 })
    }

    const issued = issueRefundConfirmToken(id, auth.barbershopId)
    const asaas = await getAsaasPaymentRefundPreview(row.externalId)
    return NextResponse.json({ ...issued, ...asaas })
  } catch (e) {
    console.error("[admin/payments/refund-token]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao gerar código" },
      { status: 500 }
    )
  }
}
