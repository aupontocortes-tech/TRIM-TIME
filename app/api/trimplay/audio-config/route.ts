import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const AUDIO_KEYS = ["combo1", "combo2", "combo3", "combo4", "gameover"] as const

export async function GET() {
  try {
    const rows = await prisma.trimPlayAudioConfig.findMany({
      where: { key: { in: [...AUDIO_KEYS] } },
      orderBy: { key: "asc" },
    })
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
