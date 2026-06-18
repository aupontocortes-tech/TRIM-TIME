import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { syncPendingSandboxPaymentsFromDb } from "@/lib/asaas/sandbox-payment-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

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

    return NextResponse.json(
      rows.map((p) => ({
        id: p.id,
        barbershop_id: p.barbershopId,
        barbershop_name: p.barbershop.name,
        barbershop_email: p.barbershop.email,
        barbershop_slug: p.barbershop.slug,
        external_id: p.externalId,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        plan: p.plan,
        metadata: p.metadata,
        created_at: p.createdAt.toISOString(),
        refundable: ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(
          p.status
        ),
      }))
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao listar cobranças" },
      { status: 500 }
    )
  }
}
