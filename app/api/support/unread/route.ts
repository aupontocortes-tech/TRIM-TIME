import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/** Quantidade de mensagens do admin ainda não lidas pela barbearia. */
export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ count: 0 })
    }
    const count = await prisma.supportMessage.count({
      where: {
        barbershopId,
        sender: "admin",
        readAt: null,
      },
    })
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
