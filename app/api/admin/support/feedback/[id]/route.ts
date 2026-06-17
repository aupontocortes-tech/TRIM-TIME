import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { isFeedbackStatus, toProductFeedbackDto } from "@/lib/product-feedback"

export const dynamic = "force-dynamic"

/** Super admin: atualizar status / notas internas. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      status?: string
      admin_notes?: string
      read_by_admin?: boolean
    }

    const existing = await prisma.productFeedback.findUnique({
      where: { id },
      include: { barbershop: { select: { name: true, slug: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Feedback não encontrado" }, { status: 404 })
    }

    const data: {
      status?: string
      adminNotes?: string | null
      readByAdmin?: boolean
    } = {}

    if (body.status !== undefined) {
      const status = String(body.status).trim()
      if (!isFeedbackStatus(status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 })
      }
      data.status = status
      data.readByAdmin = true
    }

    if (body.admin_notes !== undefined) {
      const notes = String(body.admin_notes).trim()
      data.adminNotes = notes || null
      data.readByAdmin = true
    }

    if (body.read_by_admin === true) {
      data.readByAdmin = true
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
    }

    const updated = await prisma.productFeedback.update({
      where: { id },
      data,
      include: { barbershop: { select: { name: true, slug: true } } },
    })

    return NextResponse.json(toProductFeedbackDto(updated))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: 500 }
    )
  }
}
