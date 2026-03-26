type TrimPlayRankingTopRow = {
  rank: number
  cliente_id: string
  cliente_nome: string
  score: number
}

type TrimPlayMy = null | { cliente_id: string; score: number; rank: number }

type CachedRanking = { top: TrimPlayRankingTopRow[]; my: TrimPlayMy; at: number }

function bestKey(barbershopId: string, clienteId: string) {
  return `trimplay_best_${barbershopId}_${clienteId}`
}

function pendingKey(barbershopId: string, clienteId: string) {
  return `trimplay_pending_${barbershopId}_${clienteId}`
}

function rankingKey(barbershopId: string) {
  return `trimplay_ranking_${barbershopId}`
}

export function loadBestLocal(barbershopId: string, clienteId: string): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(bestKey(barbershopId, clienteId))
    return raw ? Math.max(0, Number(raw) || 0) : 0
  } catch {
    return 0
  }
}

export function saveBestLocal(barbershopId: string, clienteId: string, score: number) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(bestKey(barbershopId, clienteId), String(Math.max(0, Math.floor(score))))
  } catch {
    /* ignore */
  }
}

export function loadPendingScore(barbershopId: string, clienteId: string): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(pendingKey(barbershopId, clienteId))
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.max(0, Math.floor(n))
  } catch {
    return null
  }
}

export function savePendingScore(barbershopId: string, clienteId: string, score: number) {
  if (typeof window === "undefined") return
  try {
    const next = Math.max(0, Math.floor(score))
    const current = loadPendingScore(barbershopId, clienteId) ?? 0
    localStorage.setItem(pendingKey(barbershopId, clienteId), String(current + next))
  } catch {
    /* ignore */
  }
}

export function clearPendingScore(barbershopId: string, clienteId: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(pendingKey(barbershopId, clienteId))
  } catch {
    /* ignore */
  }
}

export function loadCachedRanking(barbershopId: string): CachedRanking | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(rankingKey(barbershopId))
    if (!raw) return null
    return JSON.parse(raw) as CachedRanking
  } catch {
    return null
  }
}

export function saveCachedRanking(barbershopId: string, ranking: Omit<CachedRanking, "at">) {
  if (typeof window === "undefined") return
  try {
    const payload: CachedRanking = { ...ranking, at: Date.now() }
    localStorage.setItem(rankingKey(barbershopId), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

