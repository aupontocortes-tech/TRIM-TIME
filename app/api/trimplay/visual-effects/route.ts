import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type VisualEventKey = "combo1" | "combo2" | "combo3" | "combo4" | "combo5" | "victory" | "gameover"

function visualEffectRepo() {
  const repo = (prisma as unknown as { trimPlayVisualEffectAsset?: unknown }).trimPlayVisualEffectAsset
  return repo as
    | {
        findMany: (...args: unknown[]) => Promise<
          {
            id: string
            eventKey: VisualEventKey
            effectKey: string
            sortOrder: number
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

export async function GET(req: Request) {
  const repo = visualEffectRepo()
  if (!repo) {
    return NextResponse.json({
      categories: { combo1: [], combo2: [], combo3: [], combo4: [], combo5: [], victory: [], gameover: [] },
    })
  }

  try {
    const url = new URL(req.url)
    const searchAll = url.searchParams.get("all")
    const includeAll = searchAll === "1" || searchAll === "true"
    const whereClause = includeAll ? {} : { enabled: true }

    const rows = await repo.findMany({
      where: whereClause,
      orderBy: [{ eventKey: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })

    const categories: Record<VisualEventKey, { id: string; effectKey: string }[]> = {
      combo1: [],
      combo2: [],
      combo3: [],
      combo4: [],
      combo5: [],
      victory: [],
      gameover: [],
    }

    for (const x of rows) {
      const key = x.eventKey
      if (!categories[key]) continue
      categories[key].push({ id: x.id, effectKey: x.effectKey })
    }

    return NextResponse.json({ categories })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({
        categories: { combo1: [], combo2: [], combo3: [], combo4: [], combo5: [], victory: [], gameover: [] },
      })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

