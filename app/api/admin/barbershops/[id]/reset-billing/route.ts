import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { resetBarbershopBillingForFreshStart } from "@/lib/billing/reset-barbershop-billing"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const keepCard = searchParams.get("keep_card") === "1"
    const result = await resetBarbershopBillingForFreshStart(id, { keepCard })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[admin/barbershops/reset-billing]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao resetar cobranças" },
      { status: 500 }
    )
  }
}
