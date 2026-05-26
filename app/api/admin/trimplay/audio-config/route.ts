import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

const AUDIO_KEYS = new Set(["combo1", "combo2", "combo3", "combo4", "combo5", "gameover"])

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const rows = await prisma.trimPlayAudioConfig.findMany({ orderBy: { key: "asc" } })
    return NextResponse.json({
      items: rows.map((x) => ({
        key: x.key,
        file_url: x.fileUrl,
        trim_start_ms: x.trimStartMs,
        trim_end_ms: x.trimEndMs,
        volume: Number(x.volume),
        enabled: x.enabled,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json().catch(() => ({}))) as {
      key?: string
      file_url?: string | null
      trim_start_ms?: number
      trim_end_ms?: number
      volume?: number
      enabled?: boolean
    }
    const key = body.key?.trim().toLowerCase() ?? ""
    if (!AUDIO_KEYS.has(key)) {
      return NextResponse.json({ error: "key inválida" }, { status: 400 })
    }
    const trimStartMs = Math.max(0, Math.floor(Number(body.trim_start_ms ?? 0) || 0))
    const trimEndMs = Math.max(0, Math.floor(Number(body.trim_end_ms ?? 0) || 0))
    const volume = Math.min(1.5, Math.max(0, Number(body.volume ?? 1)))
    const enabled = Boolean(body.enabled)
    const fileUrl = typeof body.file_url === "string" && body.file_url.trim().length > 0 ? body.file_url.trim() : null

    const row = await prisma.trimPlayAudioConfig.upsert({
      where: { key },
      create: {
        key,
        fileUrl,
        trimStartMs,
        trimEndMs,
        volume,
        enabled,
      },
      update: {
        fileUrl,
        trimStartMs,
        trimEndMs,
        volume,
        enabled,
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        key: row.key,
        file_url: row.fileUrl,
        trim_start_ms: row.trimStartMs,
        trim_end_ms: row.trimEndMs,
        volume: Number(row.volume),
        enabled: row.enabled,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
