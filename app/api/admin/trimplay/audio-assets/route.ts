import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

const CATEGORIES = new Set(["combo1", "combo2", "combo3", "combo4", "gameover", "victory"])

function audioAssetRepo() {
  const repo = (prisma as unknown as { trimPlayAudioAsset?: unknown }).trimPlayAudioAsset
  return repo as
    | {
        findMany: (...args: unknown[]) => Promise<unknown[]>
        aggregate: (...args: unknown[]) => Promise<{ _max: { sortOrder: number | null } }>
        create: (...args: unknown[]) => Promise<{
          id: string
          category: string
          fileUrl: string
          fileName: string
          trimStartSec: number
          trimEndSec: number
          volume: number
          enabled: boolean
          sortOrder: number
        }>
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

function normalizeCategory(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace("_", "")
    .replace("game_over", "gameover")
    .replace("vitoria", "victory")
}

function validateTrim(start: number, end: number) {
  if (!(end > start)) return "tempoFinal deve ser maior que tempoInicial"
  if (end - start > 3) return "Trecho muito longo: máximo 3 segundos"
  return null
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  const repo = audioAssetRepo()
  if (!repo) {
    return NextResponse.json(
      { items: [], warning: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." },
      { status: 200 }
    )
  }
  try {
    const items = (await repo.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })) as {
      id: string
      category: string
      fileUrl: string
      fileName: string
      trimStartSec: number
      trimEndSec: number
      volume: number
      enabled: boolean
      sortOrder: number
    }[]
    return NextResponse.json({
      items: items.map((x) => ({
        id: x.id,
        category: x.category,
        file_url: x.fileUrl,
        file_name: x.fileName,
        trim_start_sec: Number(x.trimStartSec),
        trim_end_sec: Number(x.trimEndSec),
        volume: Number(x.volume),
        enabled: x.enabled,
        sort_order: x.sortOrder,
      })),
    })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({
        items: [],
        warning: "Tabela trim_play_audio_assets não encontrada. Execute as migrations para habilitar.",
      })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: Request) {
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
    const body = (await request.json().catch(() => ({}))) as {
      category?: string
      file_url?: string
      file_name?: string
      trim_start_sec?: number
      trim_end_sec?: number
      volume?: number
      enabled?: boolean
    }
    const category = normalizeCategory(body.category)
    if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Categoria inválida" }, { status: 400 })
    const fileUrl = String(body.file_url ?? "").trim()
    const fileName = String(body.file_name ?? "").trim() || "audio"
    if (!fileUrl) return NextResponse.json({ error: "file_url é obrigatório" }, { status: 400 })
    const trimStartSec = Math.max(0, Number(body.trim_start_sec ?? 0))
    const trimEndSec = Math.max(0, Number(body.trim_end_sec ?? 2))
    const err = validateTrim(trimStartSec, trimEndSec)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    const volume = Math.max(0, Math.min(1.5, Number(body.volume ?? 1)))
    const maxOrder = await repo.aggregate({
      where: { category },
      _max: { sortOrder: true },
    })
    const created = await repo.create({
      data: {
        category,
        fileUrl,
        fileName,
        trimStartSec,
        trimEndSec,
        volume,
        enabled: body.enabled ?? true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        category: created.category,
        file_url: created.fileUrl,
        file_name: created.fileName,
        trim_start_sec: Number(created.trimStartSec),
        trim_end_sec: Number(created.trimEndSec),
        volume: Number(created.volume),
        enabled: created.enabled,
        sort_order: created.sortOrder,
      },
    })
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
