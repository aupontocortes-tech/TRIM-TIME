import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

type VisualEventKey = "combo1" | "combo2" | "combo3" | "combo4" | "combo5" | "victory" | "gameover"

function visualEffectRepo() {
  const repo = (prisma as unknown as { trimPlayVisualEffectAsset?: unknown }).trimPlayVisualEffectAsset
  return repo as
    | {
        findUnique: (...args: unknown[]) => Promise<
          {
            id: string
            eventKey: VisualEventKey
            effectKey: string
            enabled: boolean
            sortOrder: number
          } | null
        >
        update: (...args: unknown[]) => Promise<unknown>
        delete: (...args: unknown[]) => Promise<unknown>
      }
    | undefined
}

function isMissingTableError(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2021"
  )
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const repo = visualEffectRepo()
  if (!repo) {
    return NextResponse.json({ error: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." }, { status: 400 })
  }

  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      enabled?: boolean
      sort_order?: number
    }

    const current = await repo.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: "Efeito não encontrado" }, { status: 404 })

    await repo.update({
      where: { id },
      data: {
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
        sortOrder: body.sort_order !== undefined ? Math.max(0, Math.floor(Number(body.sort_order))) : undefined,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({ error: "Tabela trim_play_visual_effect_assets não existe no banco. Rode as migrations." }, { status: 400 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const repo = visualEffectRepo()
  if (!repo) {
    return NextResponse.json({ error: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." }, { status: 400 })
  }

  try {
    const { id } = await params
    await repo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({ error: "Tabela trim_play_visual_effect_assets não existe no banco. Rode as migrations." }, { status: 400 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

