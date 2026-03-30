import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { Service } from "@/lib/db/types"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as Partial<Pick<Service, "name" | "price" | "duration" | "active">>
    const existing = await prisma.service.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 })

    const data = await prisma.service.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.duration !== undefined && { duration: Math.max(1, Number(body.duration) || 30) }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
      },
    })
    return NextResponse.json({
      id: data.id,
      barbershop_id: data.barbershopId,
      name: data.name,
      price: Number(data.price),
      duration: data.duration,
      active: data.active,
      created_at: data.createdAt.toISOString(),
      updated_at: data.updatedAt.toISOString(),
    } as Service)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao atualizar" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    await prisma.service.deleteMany({
      where: { id, barbershopId },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
