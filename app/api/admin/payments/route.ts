import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { findBarbershopIdByNameOrSlug } from "@/lib/billing/reset-barbershop-billing"
import { isAsaasConfigured } from "@/lib/asaas/config"
import {
  importSubscriptionPaymentsFromAsaas,
  syncBarbershopPendingPayments,
  syncPendingSandboxPaymentsFromDb,
} from "@/lib/asaas/sandbox-payment-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const REFUNDABLE_LOCAL_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
])

function mapLocalStatus(status: string): string {
  const s = status.trim().toUpperCase()
  if (s === "PAYMENT_CONFIRMED" || s === "PAYMENT_RECEIVED") return "CONFIRMED"
  return status
}

/** Lista cobranças de assinatura (super_admin). */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const barbershopId = searchParams.get("barbershop_id")?.trim() || undefined
    const q = searchParams.get("q")?.trim().toLowerCase() || ""
    const sync = searchParams.get("sync") === "1"

    if (isAsaasConfigured()) {
      let importId = barbershopId
      if (!importId && q) {
        importId = (await findBarbershopIdByNameOrSlug(q)) ?? undefined
      }
      if (importId) {
        await importSubscriptionPaymentsFromAsaas(importId).catch((e) => {
          console.warn("[admin/payments] import", importId, e)
        })
        await syncBarbershopPendingPayments(importId).catch((e) => {
          console.warn("[admin/payments] sync barbershop", importId, e)
        })
      }
    }

    if (sync) {
      await syncPendingSandboxPaymentsFromDb(25).catch((e) => {
        console.warn("[admin/payments] sync failed", e)
      })
    }

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

    return NextResponse.json(
      rows.map((p) => {
        const status = mapLocalStatus(p.status)
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
          refundable: REFUNDABLE_LOCAL_STATUSES.has(status.trim().toUpperCase()),
        }
      })
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao listar cobranças" },
      { status: 500 }
    )
  }
}
