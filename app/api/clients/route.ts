import { NextResponse } from "next/server"
import { requireBarbershopId } from "@/lib/tenant"
import { sanitizeClientNotes } from "@/lib/client-auth-notes"
import type { Client } from "@/lib/db/types"
import { prisma } from "@/lib/prisma"
import { assertValidProfilePhotoDataUrl } from "@/lib/photo-data-url"
import { cpfDigits } from "@/lib/cpf"
import { findClientByPhoneDigits } from "@/lib/client-by-phone"
import type { Prisma } from "@prisma/client"
import { assignClientsWithoutUnit, ensureClientsNetworkWide } from "@/lib/barbershop-units-seed"
import {
  barbershopHasMultipleUnits,
  requireSelectedUnitForClientCreate,
} from "@/lib/unit-context"
import { ensureClientsUnitSchemaReady } from "@/lib/client-unit-schema"

function mapClient(c: {
  id: string
  barbershopId: string
  unitId?: string | null
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
    unit_id: c.unitId ?? null,
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

export async function GET(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() || ""

    await ensureClientsUnitSchemaReady()
    await ensureClientsNetworkWide(barbershopId)
    await assignClientsWithoutUnit(barbershopId)

    const andParts: Prisma.ClientWhereInput[] = []
    if (q) {
      andParts.push({
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      })
    }

    const where: Prisma.ClientWhereInput = {
      barbershopId,
      ...(andParts.length > 0 ? { AND: andParts } : {}),
    }

    const rows = await prisma.client.findMany({
      where,
      orderBy: { name: "asc" },
    })
    return NextResponse.json(rows.map(mapClient))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não autorizado" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const barbershopId = await requireBarbershopId()
    await ensureClientsUnitSchemaReady()
    const body = await request.json() as {
      name: string
      phone?: string
      email?: string
      notes?: string
      cpf?: string
      photo_url?: string | null
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    let photoUrl: string | null = null
    try {
      photoUrl = assertValidProfilePhotoDataUrl(body.photo_url ?? null)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Foto inválida" },
        { status: 400 }
      )
    }

    const cpfRaw = String(body.cpf ?? "").trim()
    let cpfNorm: string | null = null
    if (cpfRaw) {
      cpfNorm = cpfDigits(cpfRaw)
      if (!cpfNorm) {
        return NextResponse.json({ error: "CPF inválido (use 11 dígitos)." }, { status: 400 })
      }
    }

    const phoneTrim = body.phone?.trim() ?? ""
    if (phoneTrim) {
      const dup = await findClientByPhoneDigits(barbershopId, phoneTrim)
      if (dup) {
        return NextResponse.json(
          {
            error:
              "Já existe um cliente com este telefone. Busque na lista ou edite o cadastro existente.",
          },
          { status: 409 }
        )
      }
    }

    const multiUnit = await barbershopHasMultipleUnits(barbershopId)
    let unitId: string | null = null
    if (!multiUnit) {
      const picked = await requireSelectedUnitForClientCreate(barbershopId)
      if (picked.error) {
        return NextResponse.json({ error: picked.error }, { status: 400 })
      }
      unitId = picked.unitId
    }

    const data = await prisma.client.create({
      data: {
        barbershopId,
        unitId,
        name: body.name.trim(),
        phone: phoneTrim || null,
        email: body.email?.trim().toLowerCase() ?? null,
        notes: body.notes?.trim() ?? null,
        cpf: cpfNorm,
        photoUrl,
      },
    })
    return NextResponse.json(mapClient(data))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar cliente" },
      { status: e instanceof Error && e.message.includes("não identificada") ? 401 : 500 }
    )
  }
}
