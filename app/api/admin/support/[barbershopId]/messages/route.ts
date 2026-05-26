import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ barbershopId: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { barbershopId } = await params
    const msgs = await prisma.supportMessage.findMany({
      where: { barbershopId },
      orderBy: { createdAt: "asc" },
    })

    await prisma.supportMessage.updateMany({
      where: {
        barbershopId,
        sender: "barbearia",
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ barbershopId: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const { barbershopId } = await params
    const body = (await request.json()) as { body?: string }
    const text = body.body?.trim()
    if (!text) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
    }

    const msg = await prisma.supportMessage.create({
      data: {
        barbershopId,
        body: text,
        sender: "admin",
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
