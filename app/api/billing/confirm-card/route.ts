import { NextResponse } from "next/server"
import { markCardSetupComplete } from "@/lib/asaas/billing-service"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

/** Confirma cadastro de cartão após retorno do Asaas (?card=1). */
export async function POST() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Barbershop não identificada" }, { status: 401 })
    }
    const sub = await prisma.subscription.findUnique({ where: { barbershopId } })
    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })
    }
    if (!sub.cardSetupAt) {
      await markCardSetupComplete(barbershopId)
    }
    return NextResponse.json({ ok: true, card_setup_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao confirmar cartão" },
      { status: 500 }
    )
  }
}
