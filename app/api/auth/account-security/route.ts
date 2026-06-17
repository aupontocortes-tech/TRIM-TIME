import { NextResponse } from "next/server"
import { getBarbershopPasswordHash } from "@/lib/barbershop-auth-settings"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Estado da senha da conta logada (barbearia / super admin). */
export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { email: true, settings: true, role: true, suspendedAt: true },
    })
    if (!shop) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
    }
    if (shop.suspendedAt) {
      return NextResponse.json({ error: "Conta suspensa" }, { status: 403 })
    }

    return NextResponse.json({
      email: shop.email,
      has_password: !!getBarbershopPasswordHash(shop.settings),
      role: shop.role,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar" },
      { status: 500 }
    )
  }
}
