import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { assertRefundConfirmToken } from "@/lib/admin-refund-confirm"
import { refundBarbershopPayment } from "@/lib/asaas/refund-service"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      description?: string
      value?: number
      confirm_token?: string
    }

    assertRefundConfirmToken(body.confirm_token)

    const result = await refundBarbershopPayment({
      paymentId: id,
      adminBarbershopId: auth.barbershopId,
      description: body.description,
      value: body.value,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error("[admin/payments/refund]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao estornar" },
      { status: 500 }
    )
  }
}
