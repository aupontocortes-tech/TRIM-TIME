import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBarbershopIdFromRequest } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/** Barbearia logada: histórico de suporte. */
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

    const msgs = await prisma.supportMessage.findMany({
      where: { barbershopId },
      orderBy: { createdAt: "asc" },
    })

    await prisma.supportMessage.updateMany({
      where: {
        barbershopId,
        sender: "admin",
        readAt: null,
      },
      data: { readAt: new Date() },
    })

    return NextResponse.json(
      msgs.map((m) => ({
        id: m.id,
        barbershop_id: m.barbershopId,
        body: m.body,
        sender: m.sender,
        read_at: m.readAt?.toISOString() ?? null,
        created_at: m.createdAt.toISOString(),
      }))
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}

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
      return NextResponse.json({ error: "Use o painel admin" }, { status: 400 })
    }

    const body = (await request.json()) as { body?: string }
    const text = body.body?.trim()
    if (!text) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
    }

    const msg = await prisma.supportMessage.create({
      data: {
        barbershopId,
        body: text,
        sender: "barbearia",
      },
    })

    return NextResponse.json({
      id: msg.id,
      barbershop_id: msg.barbershopId,
      body: msg.body,
      sender: msg.sender,
      read_at: msg.readAt?.toISOString() ?? null,
      created_at: msg.createdAt.toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    )
  }
}
