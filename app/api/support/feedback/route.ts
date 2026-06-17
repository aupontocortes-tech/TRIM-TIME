import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBarbershopIdFromRequest } from "@/lib/tenant"
import {
  isFeedbackArea,
  isFeedbackCategory,
  isFeedbackImpact,
  toProductFeedbackDto,
} from "@/lib/product-feedback"

export const dynamic = "force-dynamic"

/** Barbearia: listar próprios feedbacks. */
export async function GET() {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const bs = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { suspendedAt: true },
    })
    if (bs?.suspendedAt) {
      return NextResponse.json({ error: "Conta suspensa" }, { status: 403 })
    }

    const rows = await prisma.productFeedback.findMany({
      where: { barbershopId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(rows.map(toProductFeedbackDto))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar feedback" },
      { status: 500 }
    )
  }
}

/** Barbearia: enviar sugestão / melhoria estruturada. */
export async function POST(request: Request) {
  try {
    const barbershopId = await getBarbershopIdFromRequest()
    if (!barbershopId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const bs = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { suspendedAt: true, role: true },
    })
    if (bs?.suspendedAt) {
      return NextResponse.json({ error: "Conta suspensa" }, { status: 403 })
    }
    if (bs?.role === "super_admin") {
      return NextResponse.json(
        { error: "Use a plataforma Trim Time para feedback interno." },
        { status: 400 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      category?: string
      area?: string
      title?: string
      description?: string
      impact?: string
    }

    const category = String(body.category ?? "").trim()
    const areaRaw = String(body.area ?? "").trim()
    const title = String(body.title ?? "").trim()
    const description = String(body.description ?? "").trim()
    const impact = String(body.impact ?? "medium").trim()

    if (!isFeedbackCategory(category)) {
      return NextResponse.json({ error: "Selecione uma categoria válida." }, { status: 400 })
    }
    if (areaRaw && !isFeedbackArea(areaRaw)) {
      return NextResponse.json({ error: "Área do app inválida." }, { status: 400 })
    }
    if (!isFeedbackImpact(impact)) {
      return NextResponse.json({ error: "Selecione o impacto esperado." }, { status: 400 })
    }
    if (title.length < 5) {
      return NextResponse.json(
        { error: "Título muito curto (mínimo 5 caracteres)." },
        { status: 400 }
      )
    }
    if (description.length < 20) {
      return NextResponse.json(
        { error: "Descreva com mais detalhes (mínimo 20 caracteres)." },
        { status: 400 }
      )
    }

    const row = await prisma.productFeedback.create({
      data: {
        barbershopId,
        category,
        area: areaRaw || null,
        title: title.slice(0, 200),
        description,
        impact,
        status: "new",
        readByAdmin: false,
      },
    })

    return NextResponse.json(toProductFeedbackDto(row), { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao enviar feedback" },
      { status: 500 }
    )
  }
}
