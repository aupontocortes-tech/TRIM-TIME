import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { BarbershopSettings } from "@/lib/db/types"

/**
 * Dados públicos da barbearia (sem auth) — nome, contato/endereço da conta + unidades ativas.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug?.trim()) {
      return NextResponse.json({ error: "slug obrigatório" }, { status: 400 })
    }

    const b = await prisma.barbershop.findUnique({
      where: { slug: slug.trim() },
      select: {
        name: true,
        slug: true,
        phone: true,
        suspendedAt: true,
        settings: true,
        units: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            cep: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!b || b.suspendedAt) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }

    const settings = (b.settings as BarbershopSettings | null) ?? null

    return NextResponse.json({
      id: b.id,
      name: b.name,
      slug: b.slug,
      phone: b.phone,
      address: settings?.address ?? null,
      city: settings?.city ?? null,
      state: settings?.state ?? null,
      cep: settings?.cep ?? null,
      opening_hours: settings?.opening_hours ?? null,
      units: b.units,
    })
  } catch (e) {
    console.error("[public/barbershops/slug]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    )
  }
}
