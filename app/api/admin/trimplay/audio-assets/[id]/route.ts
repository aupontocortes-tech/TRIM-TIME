import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

function audioAssetRepo() {
  const repo = (prisma as unknown as { trimPlayAudioAsset?: unknown }).trimPlayAudioAsset
  return repo as
    | {
        findUnique: (...args: unknown[]) => Promise<{
          id: string
          trimStartSec: number
          trimEndSec: number
        } | null>
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

function validateTrim(start: number, end: number) {
  if (!(end > start)) return "tempoFinal deve ser maior que tempoInicial"
  if (end - start > 3) return "Trecho muito longo: máximo 3 segundos"
  return null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const repo = audioAssetRepo()
  if (!repo) {
    return NextResponse.json(
      { error: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." },
      { status: 400 }
    )
  }
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      trim_start_sec?: number
      trim_end_sec?: number
      volume?: number
      enabled?: boolean
      sort_order?: number
    }
    const current = await repo.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: "Áudio não encontrado" }, { status: 404 })

    const trimStartSec = body.trim_start_sec !== undefined ? Math.max(0, Number(body.trim_start_sec)) : Number(current.trimStartSec)
    const trimEndSec = body.trim_end_sec !== undefined ? Math.max(0, Number(body.trim_end_sec)) : Number(current.trimEndSec)
    const err = validateTrim(trimStartSec, trimEndSec)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    await repo.update({
      where: { id },
      data: {
        trimStartSec,
        trimEndSec,
        volume: body.volume !== undefined ? Math.max(0, Math.min(1.5, Number(body.volume))) : undefined,
        enabled: body.enabled,
        sortOrder: body.sort_order !== undefined ? Math.max(0, Math.floor(Number(body.sort_order))) : undefined,
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { error: "Tabela trim_play_audio_assets não existe no banco. Rode as migrations." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const repo = audioAssetRepo()
  if (!repo) {
    return NextResponse.json(
      { error: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." },
      { status: 400 }
    )
  }
  try {
    const { id } = await params
    await repo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { error: "Tabela trim_play_audio_assets não existe no banco. Rode as migrations." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
