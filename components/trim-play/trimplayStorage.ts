type TrimPlayRankingTopRow = {
  rank: number
  cliente_id: string
  cliente_nome: string
  score: number
}

type TrimPlayMy = null | { cliente_id: string; score: number; rank: number }

type CachedRanking = { top: TrimPlayRankingTopRow[]; my: TrimPlayMy; at: number }

function unitSuffix(unitId?: string | null) {
  return unitId ? `_u_${unitId}` : ""
}

function bestKey(barbershopId: string, clienteId: string, unitId?: string | null) {
  return `trimplay_best_${barbershopId}_${clienteId}${unitSuffix(unitId)}`
}

function pendingKey(barbershopId: string, clienteId: string, unitId?: string | null) {
  return `trimplay_pending_${barbershopId}_${clienteId}${unitSuffix(unitId)}`
}

function rankingKey(barbershopId: string, unitId?: string | null) {
  return `trimplay_ranking_${barbershopId}${unitSuffix(unitId)}`
}

export function loadBestLocal(barbershopId: string, clienteId: string, unitId?: string | null): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(bestKey(barbershopId, clienteId, unitId))
    return raw ? Math.max(0, Number(raw) || 0) : 0
  } catch {
    return 0
  }
}

export function saveBestLocal(barbershopId: string, clienteId: string, score: number, unitId?: string | null) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(bestKey(barbershopId, clienteId, unitId), String(Math.max(0, Math.floor(score))))
  } catch {
    /* ignore */
  }
}

export function loadPendingScore(barbershopId: string, clienteId: string, unitId?: string | null): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(pendingKey(barbershopId, clienteId, unitId))
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.max(0, Math.floor(n))
  } catch {
    return null
  }
}

export function savePendingScore(barbershopId: string, clienteId: string, score: number, unitId?: string | null) {
  if (typeof window === "undefined") return
  try {
    const next = Math.max(0, Math.floor(score))
    const current = loadPendingScore(barbershopId, clienteId, unitId) ?? 0
    localStorage.setItem(pendingKey(barbershopId, clienteId, unitId), String(current + next))
  } catch {
    /* ignore */
  }
}

export function clearPendingScore(barbershopId: string, clienteId: string, unitId?: string | null) {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(pendingKey(barbershopId, clienteId, unitId))
  } catch {
    /* ignore */
  }
}

export function loadCachedRanking(barbershopId: string, unitId?: string | null): CachedRanking | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(rankingKey(barbershopId, unitId))
    if (!raw) return null
    return JSON.parse(raw) as CachedRanking
  } catch {
    return null
  }
}

export function saveCachedRanking(
  barbershopId: string,
  ranking: Omit<CachedRanking, "at">,
  unitId?: string | null
) {
  if (typeof window === "undefined") return
  try {
    const payload: CachedRanking = { ...ranking, at: Date.now() }
    localStorage.setItem(rankingKey(barbershopId, unitId), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}
