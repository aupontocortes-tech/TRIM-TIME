import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

type VisualEventKey = "combo1" | "combo2" | "combo3" | "combo4" | "victory" | "gameover"

const VALID_EVENT_KEYS = new Set<VisualEventKey>(["combo1", "combo2", "combo3", "combo4", "victory", "gameover"])

const VALID_EFFECT_KEYS = new Set<string>([
  "efeito_texto",
  "efeito_brilho",
  "efeito_tremer",
  "efeito_flash",
  "efeito_particulas",
  "efeito_explosao",
  "efeito_raio",
  "efeito_escurecer",
  // aceitamos aliases caso o admin salve variações
  "texto",
])

const DEFAULT_VISUAL_EFFECTS: Record<VisualEventKey, string[]> = {
  combo1: ["efeito_texto", "efeito_brilho"],
  combo2: ["efeito_texto", "efeito_tremer"],
  combo3: ["efeito_texto", "efeito_tremer", "efeito_particulas"],
  combo4: ["efeito_explosao", "efeito_flash", "efeito_tremer"],
  victory: ["efeito_raio", "efeito_explosao", "efeito_flash"],
  gameover: ["efeito_escurecer", "efeito_texto"],
}

function isValidEffectKeyOrAlias(k: string) {
  if (VALID_EFFECT_KEYS.has(k)) return true
  // se vier alias, tentamos normalizar
  const normalized = normalizeEffectKey(k)
  return VALID_EFFECT_KEYS.has(normalized)
}

function visualEffectRepo() {
  const repo = (prisma as unknown as { trimPlayVisualEffectAsset?: unknown }).trimPlayVisualEffectAsset
  return repo as
    | {
        findMany: (...args: unknown[]) => Promise<
          {
            id: string
            eventKey: VisualEventKey
            effectKey: string
            enabled: boolean
            sortOrder: number
          }[]
        >
        aggregate: (...args: unknown[]) => Promise<{ _max: { sortOrder: number | null } }>
        create: (...args: unknown[]) => Promise<{
          id: string
          eventKey: VisualEventKey
          effectKey: string
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

function normalizeEventKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "")
}

function normalizeEffectKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_")
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const repo = visualEffectRepo()
  if (!repo) {
    return NextResponse.json({ items: [], warning: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." })
  }

  try {
    const items = await repo.findMany({
      orderBy: [{ eventKey: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })

    // Se estiver vazio, semear um “preset” pra destravar a UI imediatamente.
    if (items.length === 0) {
      for (const [eventKey, effectKeys] of Object.entries(DEFAULT_VISUAL_EFFECTS) as Array<[VisualEventKey, string[]]>) {
        for (let i = 0; i < effectKeys.length; i++) {
          const effectKey = effectKeys[i]!
          if (!isValidEffectKeyOrAlias(effectKey)) continue
          await repo.create({
            data: {
              eventKey,
              effectKey: effectKey,
              enabled: true,
              sortOrder: i,
            },
          })
        }
      }
    }

    const finalItems = await repo.findMany({
      orderBy: [{ eventKey: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    })
    return NextResponse.json({
      items: finalItems.map((x) => ({
        id: x.id,
        event_key: x.eventKey,
        effect_key: x.effectKey,
        enabled: x.enabled,
        sort_order: x.sortOrder,
      })),
    })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({
        items: [],
        warning: "Tabela trim_play_visual_effect_assets não encontrada. Execute as migrations para habilitar.",
      })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const repo = visualEffectRepo()
  if (!repo) {
    return NextResponse.json({ error: "Cliente Prisma desatualizado. Rode: npx prisma generate e reinicie o servidor." }, { status: 400 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      event_key?: string
      effect_key?: string
      enabled?: boolean
    }

    const eventKeyRaw = normalizeEventKey(body.event_key)
    // Normalização mais tolerante (para o painel não travar com variações/valores vazios).
    let eventKey: VisualEventKey = "combo1"
    const m = /^combo([1-4])$/i.exec(eventKeyRaw)
    if (m) eventKey = `combo${m[1]}` as VisualEventKey
    else if (eventKeyRaw === "victory" || eventKeyRaw === "vitoria") eventKey = "victory"
    else if (eventKeyRaw === "gameover" || eventKeyRaw === "gameover") eventKey = "gameover"

    let effectKey: string = normalizeEffectKey(body.effect_key)
    if (effectKey === "texto") effectKey = "efeito_texto"
    if (!effectKey) effectKey = "efeito_texto"

    const maxOrder = await repo.aggregate({
      where: { eventKey: eventKey as VisualEventKey },
      _max: { sortOrder: true },
    })

    const created = await repo.create({
      data: {
        eventKey: eventKey as VisualEventKey,
        effectKey,
        enabled: body.enabled ?? true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        event_key: created.eventKey,
        effect_key: created.effectKey,
        enabled: created.enabled,
        sort_order: created.sortOrder,
      },
    })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({ error: "Tabela trim_play_visual_effect_assets não existe no banco. Rode as migrations." }, { status: 400 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}

