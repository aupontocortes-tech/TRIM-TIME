import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function audioAssetRepo() {
  const repo = (prisma as unknown as { trimPlayAudioAsset?: unknown }).trimPlayAudioAsset
  return repo as
    | {
        findMany: (...args: unknown[]) => Promise<
          {
            id: string
            category: string
            fileUrl: string
            fileName: string
            trimStartSec: number
            trimEndSec: number
            volume: number
          }[]
        >
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

export async function GET() {
  const repo = audioAssetRepo()
  if (!repo) {
    return NextResponse.json({
      categories: { combo1: [], combo2: [], combo3: [], combo4: [], gameover: [], victory: [] },
    })
  }
  try {
    const rows = await repo.findMany({
      where: { enabled: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })
    const categories = {
      combo1: [] as unknown[],
      combo2: [] as unknown[],
      combo3: [] as unknown[],
      combo4: [] as unknown[],
      gameover: [] as unknown[],
      victory: [] as unknown[],
    }
    for (const x of rows) {
      const key = x.category as keyof typeof categories
      if (!(key in categories)) continue
      categories[key].push({
        id: x.id,
        file: x.fileUrl,
        name: x.fileName,
        start: Number(x.trimStartSec),
        end: Number(x.trimEndSec),
        volume: Number(x.volume),
      })
    }
    return NextResponse.json({ categories })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({
        categories: { combo1: [], combo2: [], combo3: [], combo4: [], gameover: [], victory: [] },
      })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
