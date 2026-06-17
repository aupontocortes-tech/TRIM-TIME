import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { toProductFeedbackDto } from "@/lib/product-feedback"

export const dynamic = "force-dynamic"

/** Super admin: todos os feedbacks + resumo por status. */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")?.trim()
    const q = searchParams.get("q")?.trim().toLowerCase()

    const rows = await prisma.productFeedback.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { barbershop: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        barbershop: { select: { name: true, slug: true } },
      },
      orderBy: [{ readByAdmin: "asc" }, { createdAt: "desc" }],
    })

    const summary = await prisma.productFeedback.groupBy({
      by: ["status"],
      _count: { _all: true },
    })

    const unread = await prisma.productFeedback.count({ where: { readByAdmin: false } })

    return NextResponse.json({
      items: rows.map((r) => toProductFeedbackDto(r)),
      summary: Object.fromEntries(summary.map((s) => [s.status, s._count._all])),
      unread,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar feedback" },
      { status: 500 }
    )
  }
}
