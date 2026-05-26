import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { sanitizeClientNotes } from "@/lib/client-auth-notes"
import type { Client } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { cpfDigits } from "@/lib/cpf"

function mapClient(c: {
  id: string
  barbershopId: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  cpf: string | null
  photoUrl: string | null
  loyaltyPoints: number
  createdAt: Date
  updatedAt: Date
}): Client {
  return {
    id: c.id,
    barbershop_id: c.barbershopId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: sanitizeClientNotes(c.notes),
    cpf: c.cpf,
    photo_url: c.photoUrl,
    loyalty_points: c.loyaltyPoints,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const barbershopId = await requireBarbershopId()
    const { id } = await params
    const body = await _request.json() as Partial<
      Pick<Client, "name" | "phone" | "email" | "notes" | "cpf" | "photo_url">
    >

    const update: {
      name?: string
      phone?: string | null
      email?: string | null
      notes?: string | null
      cpf?: string | null
      photoUrl?: string | null
    } = {}

    if (body.name !== undefined) {
      const n = String(body.name).trim()
      if (!n) return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 })
      update.name = n
    }
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null
    if (body.email !== undefined) {
      const e = String(body.email).trim().toLowerCase()
      update.email = e || null
    }
    if (body.notes !== undefined) update.notes = body.notes?.trim() ?? null
    if (body.cpf !== undefined) {
      const raw = String(body.cpf).trim()
      if (!raw) update.cpf = null
      else {
        const d = cpfDigits(raw)
        if (!d) return NextResponse.json({ error: "CPF inválido (use 11 dígitos)." }, { status: 400 })
        update.cpf = d
      }
    }
    if (body.photo_url !== undefined) {
      try {
        update.photoUrl = assertValidProfilePhotoDataUrl(body.photo_url)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Foto inválida" },
          { status: 400 }
        )
      }
    }

    const existing = await prisma.client.findFirst({
      where: { id, barbershopId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })

    const data = await prisma.client.update({
      where: { id },
      data: update,
    })
    return NextResponse.json(mapClient(data))
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
    const { count } = await prisma.client.deleteMany({
      where: { id, barbershopId },
    })
    if (!count) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao excluir" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
