import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import type { RetailProduct } from "@/lib/db/types"

function rowToApi(r: {
  id: string
  barbershopId: string
  name: string
  description: string
  price: unknown
  active: boolean
  createdAt: Date
  updatedAt: Date
}): RetailProduct {
  return {
    id: r.id,
    barbershop_id: r.barbershopId,
    name: r.name,
    description: (r.description ?? "").trim(),
    price: Number(r.price),
    active: r.active,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = (await request.json()) as Partial<
      Pick<RetailProduct, "name" | "description" | "price" | "active">
    >
    const existing = await prisma.retailProduct.findFirst({
      where: { id, barbershopId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }
    const data: {
      name?: string
      description?: string
      price?: number
      active?: boolean
    } = {}
    if (body.name !== undefined) data.name = String(body.name).trim() || existing.name
    if (body.description !== undefined) data.description = String(body.description).trim().slice(0, 2000)
    if (body.price !== undefined) {
      const p = Number(body.price)
      if (Number.isNaN(p) || p < 0) {
        return NextResponse.json({ error: "Preço inválido" }, { status: 400 })
      }
      data.price = p
    }
    if (body.active !== undefined) data.active = Boolean(body.active)

    const updated = await prisma.retailProduct.update({
      where: { id },
      data,
    })
    if (updated.barbershopId !== barbershopId) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }
    return NextResponse.json(rowToApi(updated) as RetailProduct)
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
    const row = await prisma.retailProduct.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    })
    if (!row) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 })
    }
    try {
      await prisma.retailProduct.delete({ where: { id } })
    } catch {
      return NextResponse.json(
        { error: "Não é possível excluir: produto já vinculado a agendamentos." },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
