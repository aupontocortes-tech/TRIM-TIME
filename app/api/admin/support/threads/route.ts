import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

/** Lista barbearias com última mensagem e não lidas (mensagens da barbearia). */
export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const shops = await prisma.barbershop.findMany({
      where: { NOT: { role: "super_admin" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    })

    const threads = await Promise.all(
      shops.map(async (s) => {
        const [last, unreadFromBarbershop] = await Promise.all([
          prisma.supportMessage.findFirst({
            where: { barbershopId: s.id },
            orderBy: { createdAt: "desc" },
          }),
          prisma.supportMessage.count({
            where: {
              barbershopId: s.id,
              sender: "barbearia",
              readAt: null,
            },
          }),
        ])
        return {
          barbershop_id: s.id,
          name: s.name,
          slug: s.slug,
          last_message: last
            ? {
                body: last.body,
                sender: last.sender,
                created_at: last.createdAt.toISOString(),
              }
            : null,
          unread_from_barbershop: unreadFromBarbershop,
        }
      })
    )

    return NextResponse.json(threads)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
