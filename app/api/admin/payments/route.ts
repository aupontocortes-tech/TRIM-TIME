import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAsaasPayment } from "@/lib/asaas/client"
import { isAsaasConfigured } from "@/lib/asaas/config"
import { canRefundAsaasPayment } from "@/lib/asaas/refund-service"
import { syncPendingSandboxPaymentsFromDb } from "@/lib/asaas/sandbox-payment-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const LOCALLY_REFUNDABLE = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
])

function displayStatusFromAsaas(asaasStatus: string, refundable: boolean): string {
  const s = asaasStatus.trim().toUpperCase()
  if (s === "REFUNDED") return "REFUNDED"
  if (refundable) return "CONFIRMED"
  if (s === "PENDING" || s === "AWAITING_RISK_ANALYSIS") return "PENDING"
  return s
}

async function resolveRefundability(row: {
  id: string
  status: string
  externalId: string | null
}): Promise<{ status: string; refundable: boolean }> {
  if (row.status === "REFUNDED" || !row.externalId) {
    return { status: row.status, refundable: false }
  }

  const locallyRefundable = LOCALLY_REFUNDABLE.has(row.status)
  if (!isAsaasConfigured()) {
    return { status: row.status, refundable: locallyRefundable }
  }

  try {
    const asaas = await getAsaasPayment(row.externalId)
    const refundable = canRefundAsaasPayment(asaas)
    const status = displayStatusFromAsaas(asaas.status, refundable)

    // Só corrige para "pago" no banco; não rebaixa Pago → Pendente (sync sandbox cuida disso).
    if (status === "CONFIRMED" && row.status !== "CONFIRMED") {
      await prisma.payment
        .update({ where: { id: row.id }, data: { status: "CONFIRMED" } })
        .catch(() => {})
    }

    return { status, refundable }
  } catch {
    return { status: row.status, refundable: locallyRefundable }
  }
}

/** Lista cobranças de assinatura (super_admin). */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const barbershopId = searchParams.get("barbershop_id")?.trim() || undefined
    const q = searchParams.get("q")?.trim().toLowerCase() || ""

    await syncPendingSandboxPaymentsFromDb()

    const rows = await prisma.payment.findMany({
      where: {
        provider: "asaas",
        ...(barbershopId ? { barbershopId } : {}),
        ...(q
          ? {
              barbershop: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { slug: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        barbershop: { select: { id: true, name: true, email: true, slug: true } },
      },
    })

    const enriched = await Promise.all(
      rows.map(async (p) => {
        const { status, refundable } = await resolveRefundability(p)
        return {
          id: p.id,
          barbershop_id: p.barbershopId,
          barbershop_name: p.barbershop.name,
          barbershop_email: p.barbershop.email,
          barbershop_slug: p.barbershop.slug,
          external_id: p.externalId,
          amount: Number(p.amount),
          currency: p.currency,
          status,
          plan: p.plan,
          metadata: p.metadata,
          created_at: p.createdAt.toISOString(),
          refundable,
        }
      })
    )

    return NextResponse.json(enriched)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao listar cobranças" },
      { status: 500 }
    )
  }
}
