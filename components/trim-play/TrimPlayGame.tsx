"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Settings, Trophy, Volume2, VolumeX, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TrimPlayRankingPanel } from "./TrimPlayRankingPanel"
import { fetchTrimPlayRanking, submitTrimPlayScore } from "./trimplayApi"
import {
  clearPendingScore,
  loadBestLocal,
  loadPendingScore,
  saveBestLocal,
  savePendingScore,
  saveCachedRanking,
} from "./trimplayStorage"
import {
  getTrimPlayMuted,
  playTrimPlayCombo,
  playTrimPlayGameOver,
  playTrimPlayLineClear,
  playTrimPlayPlace,
  playTrimPlayVictory,
  setTrimPlayMuted,
  unlockTrimPlayAudio,
} from "./trimPlayHowler"

const SIZE = 8

type VisualEventKey = "combo1" | "combo2" | "combo3" | "combo4" | "victory" | "gameover"

type VisualEffectKey =
  | "efeito_texto"
  | "efeito_brilho"
  | "efeito_tremer"
  | "efeito_flash"
  | "efeito_particulas"
  | "efeito_explosao"
  | "efeito_raio"
  | "efeito_escurecer"

type VisualEffectAsset = { id: string; effectKey: string }

/** Alinha com o admin/API: aceita `texto`, `efeito_texto`, etc. */
function toVisualEffectKey(raw: unknown): VisualEffectKey | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_")
  const map: Record<string, VisualEffectKey> = {
    texto: "efeito_texto",
    efeito_texto: "efeito_texto",
    brilho: "efeito_brilho",
    efeito_brilho: "efeito_brilho",
    tremer: "efeito_tremer",
    efeito_tremer: "efeito_tremer",
    flash: "efeito_flash",
    efeito_flash: "efeito_flash",
    particulas: "efeito_particulas",
    particula: "efeito_particulas",
    efeito_particulas: "efeito_particulas",
    explosao: "efeito_explosao",
    efeito_explosao: "efeito_explosao",
    raio: "efeito_raio",
    efeito_raio: "efeito_raio",
    escurecer: "efeito_escurecer",
    efeito_escurecer: "efeito_escurecer",
  }
  return map[s] ?? null
}

const FALLBACK_VISUAL_EVENTS: Record<VisualEventKey, VisualEffectAsset[]> = {
  combo1: [{ id: "fallback_combo1_0", effectKey: "efeito_texto" }],
  combo2: [{ id: "fallback_combo2_0", effectKey: "efeito_flash" }],
  combo3: [{ id: "fallback_combo3_0", effectKey: "efeito_tremer" }],
  combo4: [{ id: "fallback_combo4_0", effectKey: "efeito_explosao" }],
  victory: [{ id: "fallback_victory_0", effectKey: "efeito_raio" }],
  gameover: [{ id: "fallback_gameover_0", effectKey: "efeito_escurecer" }],
}

function normalizeVisualAssets(list: VisualEffectAsset[] | undefined): VisualEffectAsset[] {
  if (!Array.isArray(list)) return []
  return list.map((a) => {
    const k = toVisualEffectKey(a?.effectKey)
    return { id: a.id, effectKey: k ?? "efeito_texto" }
  })
}

type Particle = {
  id: string
  sizePx: number
  // coordenadas em porcentagem do tabuleiro (0-100)
  x1Pct: number
  y1Pct: number
  x2Pct: number
  y2Pct: number
  delayMs: number
  hue: number
}

/** iOS/Android: permite preventDefault no arrasto e evita scroll “roubar” o gesto */
const POINTER_MOVE_OPTS: AddEventListenerOptions = { passive: false }

type ShapeCell = { r: number; c: number }

const SHAPE_TEMPLATES: ShapeCell[][] = (
  [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  ] as [number, number][][]
).map((cells) => normalizeShape(cells.map(([r, c]) => ({ r, c }))))

function normalizeShape(cells: ShapeCell[]): ShapeCell[] {
  if (!cells.length) return cells
  const minR = Math.min(...cells.map((x) => x.r))
  const minC = Math.min(...cells.map((x) => x.c))
  return cells.map((x) => ({ r: x.r - minR, c: x.c - minC }))
}

function shapeDims(cells: ShapeCell[]) {
  const maxR = Math.max(...cells.map((x) => x.r))
  const maxC = Math.max(...cells.map((x) => x.c))
  return { h: maxR + 1, w: maxC + 1 }
}

type BoardCell = { hue: number } | null
type HandPiece = { id: string; cells: ShapeCell[]; hue: number; templateId: string }
/** shapeBand: 1 = pequenas/simples (mono, dom, linha3, 2×2), 2 = L/Z médios, 3 = grandes/T/linha4 */
type ShapeTemplateDef = { id: string; cells: ShapeCell[]; difficulty: 1 | 2 | 3; weight: number; shapeBand: 1 | 2 | 3 }

export type TrimPlayDifficultyStage = "facil" | "media" | "dificil"

/** Fase sobe com pontuação, linhas limpas no total e melhor combo já feito — início bem longo e fácil. */
export function trimPlayPhaseFromStats(score: number, linesLifetime: number, maxComboEver: number): number {
  const progress =
    score * 0.88 +
    linesLifetime * 44 +
    Math.max(0, maxComboEver - 1) * 130
  const step = 520
  return Math.min(45, 1 + Math.floor(progress / step))
}

function tierFromPhase(phase: number): 1 | 2 | 3 {
  if (phase <= 4) return 1
  if (phase <= 10) return 2
  return 3
}

export function trimPlayStageFromPhase(phase: number): TrimPlayDifficultyStage {
  const t = tierFromPhase(phase)
  return t === 1 ? "facil" : t === 2 ? "media" : "dificil"
}

/** Legado: ainda útil para telas que só têm score */
export function trimPlayDifficultyFromScore(score: number): TrimPlayDifficultyStage {
  const ph = trimPlayPhaseFromStats(score, 0, 0)
  return trimPlayStageFromPhase(ph)
}

/** Progresso 0..1 dentro do tier atual (fases) */
function difficultyProgressFromPhase(phase: number): { tier: 1 | 2 | 3; segmentT: number } {
  const tier = tierFromPhase(phase)
  const lo = tier === 1 ? 1 : tier === 2 ? 5 : 11
  const hi = tier === 1 ? 4 : tier === 2 ? 10 : 45
  const segmentT = hi > lo ? Math.min(1, Math.max(0, (phase - lo) / (hi - lo))) : 0
  return { tier, segmentT }
}

type DragPayload = {
  slot: number
  piece: HandPiece
  offsetX: number
  offsetY: number
  x: number
  y: number
}

function emptyBoard(): BoardCell[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null))
}

/** Uma banda por template (mesma ordem que SHAPE_TEMPLATES) */
const SHAPE_BAND_BY_INDEX: (1 | 2 | 3)[] = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3]

const SHAPE_LIBRARY: ShapeTemplateDef[] = SHAPE_TEMPLATES.map((cells, i) => {
  const area = cells.length
  const { h, w } = shapeDims(cells)
  const span = Math.max(h, w)
  const isLine4 = area === 4 && (h === 1 || w === 1)
  const difficulty: 1 | 2 | 3 =
    area <= 2 ? 1 : area >= 4 || span >= 4 || isLine4 ? 3 : area === 3 && span >= 3 ? 2 : 2
  const shapeBand = SHAPE_BAND_BY_INDEX[i] ?? 2
  return {
    id: `s${i + 1}`,
    cells,
    difficulty,
    shapeBand,
    weight: difficulty === 1 ? 1.2 : difficulty === 2 ? 1 : 0.85,
  }
})

function countPlacements(board: BoardCell[][], cells: ShapeCell[]) {
  let count = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (canPlace(board, cells, r, c)) count++
    }
  }
  return count
}

function boardFillRatio(board: BoardCell[][]) {
  let occupied = 0
  for (const row of board) {
    for (const cell of row) if (cell) occupied++
  }
  return occupied / (SIZE * SIZE)
}

function isBoardEmpty(board: BoardCell[][]) {
  for (const row of board) {
    for (const cell of row) {
      if (cell) return false
    }
  }
  return true
}

/** Peso relativo por banda geométrica conforme o estágio do jogo (pontuação) */
function shapeBandPreference(shapeBand: 1 | 2 | 3, gameTier: 1 | 2 | 3): number {
  if (gameTier === 1) {
    if (shapeBand === 1) return 2.35
    if (shapeBand === 2) return 0.52
    return 0.14
  }
  if (gameTier === 2) {
    if (shapeBand === 1) return 1.2
    if (shapeBand === 2) return 1.45
    return 0.62
  }
  if (shapeBand === 1) return 0.32
  if (shapeBand === 2) return 0.92
  return 1.95
}

/** Anti-frustração: reduz tier efetivo e favorece encaixes quando o tabuleiro aperta */
function effectiveGameTier(phase: number, fillRatio: number, fitTemplateCount: number): 1 | 2 | 3 {
  const tier = tierFromPhase(phase)
  const crowded = fillRatio >= 0.62
  const fewOptions = fitTemplateCount <= 5
  const critical = fillRatio >= 0.72 || fitTemplateCount <= 3
  if (critical) return 1
  if (crowded || fewOptions) return Math.max(1, tier - 1) as 1 | 2 | 3
  return tier
}

export type TrimPlayDealContext = { score: number; linesLifetime: number; maxComboEver: number }

function weightedPick<T>(entries: { item: T; weight: number }[]): T {
  const total = entries.reduce((acc, e) => acc + Math.max(0, e.weight), 0)
  let roll = Math.random() * Math.max(total, 0.0001)
  for (const e of entries) {
    roll -= Math.max(0, e.weight)
    if (roll <= 0) return e.item
  }
  return entries[entries.length - 1]!.item
}

function makePiece(template: ShapeTemplateDef): HandPiece {
  const hue = Math.floor(Math.random() * 6)
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    cells: [...template.cells],
    hue,
    templateId: template.id,
  }
}

function pickTemplateForBoard(board: BoardCell[][], ctx: TrimPlayDealContext, recentIds: string[]): ShapeTemplateDef {
  const phase = trimPlayPhaseFromStats(ctx.score, ctx.linesLifetime, ctx.maxComboEver)
  const { maxComboEver } = ctx
  const fillRatio = boardFillRatio(board)
  const { tier, segmentT } = difficultyProgressFromPhase(phase)

  const fitData = SHAPE_LIBRARY.map((t) => ({ t, fits: countPlacements(board, t.cells) }))
  const fitCandidates = fitData.filter((x) => x.fits > 0)
  const gameTier = effectiveGameTier(phase, fillRatio, fitCandidates.length)

  const nearLosing = fillRatio >= 0.62 || fitCandidates.length <= 5
  const critical = fillRatio >= 0.72 || fitCandidates.length <= 3
  const earlyPhaseHelp = phase <= 2 ? 0.34 : phase <= 4 ? 0.2 : phase <= 7 ? 0.08 : 0
  let saverChance = critical ? 0.58 : nearLosing ? 0.38 : 0.12
  saverChance = Math.min(0.72, saverChance + earlyPhaseHelp)

  if (Math.random() < saverChance) {
    const saver = fitCandidates.filter((x) => x.t.shapeBand === 1 || x.t.cells.length <= 3)
    if (saver.length > 0) {
      const fitPow = phase <= 2 ? 1.65 : 1.35
      return weightedPick(
        saver.map((x) => ({
          item: x.t,
          weight: Math.pow(x.fits, fitPow) * (x.fits + 2) * (recentIds.includes(x.t.id) ? 0.52 : 1),
        }))
      )
    }
  }

  // Quem faz combos fortes acelera um pouco a “sensação” de dificuldade (sem pular fases inteiras).
  const comboMomentum = Math.min(0.22, Math.max(0, maxComboEver - 2) * 0.045)

  const bandBoost =
    (segmentT * 0.24 + comboMomentum) * (tier === 1 ? 0.82 : tier === 2 ? 1 : 1.08)
  const source = fitCandidates.length > 0 ? fitCandidates : fitData

  const fitPowPick = phase <= 2 ? 1.45 : phase <= 5 ? 1.22 : 1
  const earlyFitBoost = phase <= 2 ? 2.85 : phase <= 4 ? 1.75 : phase <= 7 ? 1.28 : 1

  return weightedPick(
    source.map((x) => {
      const basePref = shapeBandPreference(x.t.shapeBand, gameTier)
      const nudgeHard =
        x.t.shapeBand >= 2
          ? basePref * (1 + bandBoost * (x.t.shapeBand - 1))
          : basePref * (1 - bandBoost * 0.35)
      const bandWeight = Math.max(0.08, nudgeHard)
      const diffDistance = Math.abs(x.t.difficulty - tier)
      const difficultyWeight = diffDistance === 0 ? 1.45 : diffDistance === 1 ? 1 : 0.68
      const rawFit = nearLosing ? x.fits * x.fits + 2 : Math.pow(Math.max(1, x.fits), fitPowPick) + 1
      const fitWeight = Math.max(1, Math.min(26, rawFit * earlyFitBoost))
      const repeatPenalty = recentIds.includes(x.t.id) ? 0.48 : 1
      return {
        item: x.t,
        weight: x.t.weight * bandWeight * difficultyWeight * fitWeight * repeatPenalty,
      }
    })
  )
}

/** Garante ao menos uma peça encaixável no tabuleiro atual (evita mão morta só por RNG). */
function ensureAtLeastOnePlacement(board: BoardCell[][], hand: HandPiece[]): HandPiece[] {
  if (canPlaceAnyPiece(board, hand)) return hand

  const ranked = SHAPE_LIBRARY.map((t) => ({ t, fits: countPlacements(board, t.cells) }))
    .filter((x) => x.fits > 0)
    .sort((a, b) => b.fits - a.fits)

  if (ranked.length === 0) return hand

  const preferEasy = ranked.filter((x) => x.t.shapeBand === 1)
  const pickFrom = preferEasy.length > 0 ? preferEasy : ranked
  const best = pickFrom[0]!.t
  const slot = Math.floor(Math.random() * 3)
  const copy = hand.slice()
  copy[slot] = makePiece(best)
  return copy
}

function dealHand(board: BoardCell[][], ctx: TrimPlayDealContext, recentIds: string[]): (HandPiece | null)[] {
  const next: HandPiece[] = []
  const recent = [...recentIds]
  for (let i = 0; i < 3; i++) {
    const template = pickTemplateForBoard(board, ctx, recent)
    next.push(makePiece(template))
    recent.push(template.id)
    if (recent.length > 8) recent.shift()
  }
  return ensureAtLeastOnePlacement(board, next)
}

function canPlace(board: BoardCell[][], cells: ShapeCell[], ar: number, ac: number) {
  for (const { r: dr, c: dc } of cells) {
    const r = ar + dr
    const c = ac + dc
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false
    if (board[r][c]) return false
  }
  return true
}

function placePiece(board: BoardCell[][], cells: ShapeCell[], ar: number, ac: number, hue: number): BoardCell[][] {
  const next = board.map((row) => row.slice())
  for (const { r: dr, c: dc } of cells) {
    next[ar + dr][ac + dc] = { hue }
  }
  return next
}

function findClears(board: BoardCell[][]) {
  const clear = new Set<string>()
  let rows = 0
  let cols = 0

  for (let r = 0; r < SIZE; r++) {
    if (board[r].every((cell) => cell !== null)) {
      rows++
      for (let c = 0; c < SIZE; c++) clear.add(`${r},${c}`)
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true
    for (let r = 0; r < SIZE; r++) {
      if (!board[r][c]) {
        full = false
        break
      }
    }
    if (full) {
      cols++
      for (let r = 0; r < SIZE; r++) clear.add(`${r},${c}`)
    }
  }

  return {
    coords: Array.from(clear).map((s) => {
      const [rs, cs] = s.split(",")
      return { r: Number(rs), c: Number(cs) }
    }),
    lineCount: rows + cols,
  }
}

function applyClears(board: BoardCell[][], coords: { r: number; c: number }[]) {
  const next = board.map((row) => row.slice())
  for (const { r, c } of coords) next[r][c] = null
  return next
}

function resolveClears(board: BoardCell[][]): {
  board: BoardCell[][]
  cellsCleared: number
  linesTotal: number
  rounds: number
} {
  let b = board
  let cellsCleared = 0
  let linesTotal = 0
  let rounds = 0
  for (let guard = 0; guard < 20; guard++) {
    const { coords, lineCount } = findClears(b)
    if (!coords.length) break
    rounds++
    cellsCleared += coords.length
    linesTotal += lineCount
    b = applyClears(b, coords)
  }
  return { board: b, cellsCleared, linesTotal, rounds }
}

function canPlaceAnyPiece(board: BoardCell[][], hand: (HandPiece | null)[]) {
  for (const piece of hand) {
    if (!piece) continue
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (canPlace(board, piece.cells, r, c)) return true
      }
    }
  }
  return false
}

type GridMeasure = {
  originLeft: number
  originTop: number
  stepX: number
  stepY: number
}

/** Mede passo e origem com as células reais (borda a borda no DOM) — evita erro de grid teórico vs CSS */
function measureBoardFromDom(gridEl: HTMLElement): GridMeasure | null {
  const q = (r: number, c: number) =>
    gridEl.querySelector(`[data-board-cell][data-br="${r}"][data-bc="${c}"]`) as HTMLElement | null
  const el00 = q(0, 0)
  const el01 = q(0, 1)
  const el10 = q(1, 0)
  if (!el00 || !el01 || !el10) return null
  const r00 = el00.getBoundingClientRect()
  const r01 = el01.getBoundingClientRect()
  const r10 = el10.getBoundingClientRect()
  const stepX = r01.left - r00.left
  const stepY = r10.top - r00.top
  if (!(stepX > 0) || !(stepY > 0)) return null
  return {
    originLeft: r00.left,
    originTop: r00.top,
    stepX,
    stepY,
  }
}

/**
 * Entre todos os encaixes válidos, escolhe o mais próximo do ghost (canto da peça).
 * Tolerância ampla (~3+ células): estilo puzzle rápido — não precisa encostar no alvo.
 */
function pickDropAnchor(
  shapeLeft: number,
  shapeTop: number,
  gridEl: HTMLElement,
  cells: ShapeCell[],
  board: BoardCell[][]
): { ar: number; ac: number } | null {
  const m = measureBoardFromDom(gridEl)
  if (!m) return null

  let best: { ar: number; ac: number } | null = null
  let bestPx = Infinity

  for (let ar = 0; ar < SIZE; ar++) {
    for (let ac = 0; ac < SIZE; ac++) {
      if (!canPlace(board, cells, ar, ac)) continue
      const snapX = m.originLeft + ac * m.stepX
      const snapY = m.originTop + ar * m.stepY
      const px2 = (shapeLeft - snapX) ** 2 + (shapeTop - snapY) ** 2
      if (px2 < bestPx) {
        bestPx = px2
        best = { ar, ac }
      }
    }
  }

  if (!best) return null
  const cell = Math.min(m.stepX, m.stepY)
  /** Raio em células: soltar longe do alvo ainda encaixa no encaixe válido mais próximo (puzzle rápido) */
  const maxSlopCells = 5.25
  const maxSlop = cell * maxSlopCells
  if (bestPx > maxSlop * maxSlop) return null
  return best
}

const HUE_STYLES: { fill: string; glow: string; border: string }[] = [
  { fill: "#e8b84a", glow: "rgba(232,184,74,0.45)", border: "#f5d78a" },
  { fill: "#c9a227", glow: "rgba(201,162,39,0.45)", border: "#e8c84a" },
  { fill: "#f0d060", glow: "rgba(240,208,96,0.45)", border: "#fff0a0" },
  { fill: "#b8860b", glow: "rgba(184,134,11,0.45)", border: "#daa520" },
  { fill: "#ffd56b", glow: "rgba(255,213,107,0.45)", border: "#ffe8a8" },
  { fill: "#9a7b1a", glow: "rgba(154,123,26,0.45)", border: "#c9a227" },
]

function glossyBlockStyle(hs: (typeof HUE_STYLES)[number]): CSSProperties {
  return {
    background: `linear-gradient(155deg, ${hs.border} 0%, ${hs.fill} 40%, ${hs.fill} 60%, rgba(35, 28, 6, 0.92) 100%)`,
    borderColor: hs.border,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -5px 14px rgba(0,0,0,0.5), 0 0 16px ${hs.glow}`,
  }
}

function ShapePreview({
  cells,
  hue,
  cellPx,
  gapPx,
  dimmed,
}: {
  cells: ShapeCell[]
  hue: number
  cellPx: number
  gapPx: number
  dimmed?: boolean
}) {
  const { h, w } = shapeDims(cells)
  const style = {
    width: w * cellPx + (w - 1) * gapPx,
    height: h * cellPx + (h - 1) * gapPx,
    display: "grid",
    gridTemplateColumns: `repeat(${w}, ${cellPx}px)`,
    gridTemplateRows: `repeat(${h}, ${cellPx}px)`,
    gap: gapPx,
    opacity: dimmed ? 0.92 : 1,
  } as const
  const hs = HUE_STYLES[hue % HUE_STYLES.length]!
  const slots = Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => {
      const filled = cells.some((x) => x.r === r && x.c === c)
      return (
        <div
          key={`${r}_${c}`}
          className="rounded-sm"
          style={
            filled
              ? {
                  ...glossyBlockStyle(hs),
                  borderWidth: 1,
                  borderStyle: "solid",
                }
              : { background: "transparent" }
          }
        />
      )
    })
  ).flat()

  return (
    <div data-trimplay-shape style={style}>
      {slots}
    </div>
  )
}

export function TrimPlayGame({
  barbershopId,
  clienteId,
  clienteNome,
  onExit,
}: {
  barbershopId: string
  clienteId: string
  clienteNome: string
  onExit: () => void
}) {
  const [board, setBoard] = useState<BoardCell[][]>(() => emptyBoard())
  const [linesLifetime, setLinesLifetime] = useState(0)
  const [maxComboEver, setMaxComboEver] = useState(0)
  const [hand, setHand] = useState<(HandPiece | null)[]>(() => {
    const base = emptyBoard()
    const ctx: TrimPlayDealContext = { score: 0, linesLifetime: 0, maxComboEver: 0 }
    return dealHand(base, ctx, [])
  })
  const [score, setScore] = useState(0)
  const phase = useMemo(
    () => trimPlayPhaseFromStats(score, linesLifetime, maxComboEver),
    [score, linesLifetime, maxComboEver]
  )
  const difficultyUiLabel = useMemo(() => {
    const s = trimPlayStageFromPhase(phase)
    return s === "facil" ? "Fácil" : s === "media" ? "Médio" : "Difícil"
  }, [phase])
  const [moves, setMoves] = useState(0)
  const [comboStreak, setComboStreak] = useState(0)
  const [state, setState] = useState<"playing" | "over">("playing")
  const [toast, setToast] = useState<string | null>(null)
  const [peakBanner, setPeakBanner] = useState(false)
  const [visualEffectActive, setVisualEffectActive] = useState<null | {
    effectKey: VisualEffectKey
    token: number
    text?: string
    particles?: Particle[]
    rayHue?: number
  }>(null)
  const [visualParticlesToken, setVisualParticlesToken] = useState(0)
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [dropPreview, setDropPreview] = useState<{ ar: number; ac: number; ok: boolean } | null>(null)

  const [bestLocal, setBestLocal] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [myRanking, setMyRanking] = useState<null | { rank: number; score: number }>(null)

  const [visualEvents, setVisualEvents] = useState<Record<VisualEventKey, VisualEffectAsset[]>>({
    combo1: [],
    combo2: [],
    combo3: [],
    combo4: [],
    victory: [],
    gameover: [],
  })
  const visualEventsRef = useRef(visualEvents)
  const visualsLoadedRef = useRef(false)
  const visualIdxRef = useRef<Record<VisualEventKey, number>>({
    combo1: 0,
    combo2: 0,
    combo3: 0,
    combo4: 0,
    victory: 0,
    gameover: 0,
  })

  /** Layout estreito (celular): peças e ghost menores; desktop sm+ mais folgado */
  const [compactUi, setCompactUi] = useState(true)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(min-width: 640px)")
    const apply = () => setCompactUi(!mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])
  const trayCellPx = compactUi ? 16 : 22
  const trayGapPx = compactUi ? 2 : 3
  const ghostCellPx = compactUi ? 18 : 22
  const ghostGapPx = compactUi ? 2 : 3

  useEffect(() => {
    setSoundMuted(getTrimPlayMuted())
  }, [])

  useEffect(() => {
    if (!rankingOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [rankingOpen])

  useEffect(() => {
    if (!rankingOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRankingOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [rankingOpen])

  useEffect(() => {
    if (state === "over") setRankingOpen(false)
  }, [state])

  const boardGridRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef(board)
  const handRef = useRef(hand)
  const scoreRef = useRef(score)
  const movesRef = useRef(moves)
  const stateRef = useRef(state)
  const dragRef = useRef<DragPayload | null>(null)
  const pointerCaptureRef = useRef<{ el: HTMLElement; id: number } | null>(null)
  const dragPointerListenersCleanupRef = useRef<(() => void) | null>(null)
  const comboStreakRef = useRef(0)
  const recentTemplatesRef = useRef<string[]>([])
  const unsyncedRoundPointsRef = useRef(0)

  boardRef.current = board
  handRef.current = hand
  scoreRef.current = score
  movesRef.current = moves
  stateRef.current = state
  dragRef.current = drag
  comboStreakRef.current = comboStreak
  visualEventsRef.current = visualEvents

  useEffect(() => {
    const best = loadBestLocal(barbershopId, clienteId)
    setBestLocal(best)
  }, [barbershopId, clienteId])

  const refreshMyRanking = useCallback(async () => {
    try {
      if (!navigator.onLine) return
      const ranking = await fetchTrimPlayRanking({ barbershopId, clienteId })
      saveCachedRanking(barbershopId, { top: ranking.top, my: ranking.my })
      setMyRanking(ranking.my ? { rank: ranking.my.rank, score: ranking.my.score } : null)
    } catch {
      // ranking temporariamente indisponivel
    }
  }, [barbershopId, clienteId])

  useEffect(() => {
    recentTemplatesRef.current = hand.filter(Boolean).map((x) => x!.templateId)
    // executa uma vez com a mão inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void refreshMyRanking()
  }, [refreshMyRanking])

  useEffect(() => {
    const refresh = () => void refreshMyRanking()
    const timer = window.setInterval(refresh, 12000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [refreshMyRanking])

  const syncPending = async () => {
    const pending = loadPendingScore(barbershopId, clienteId)
    if (pending === null) return
    try {
      if (!navigator.onLine) return
      await submitTrimPlayScore({
        barbershopId,
        clienteId,
        clienteName: clienteNome,
        score: pending,
      })
      clearPendingScore(barbershopId, clienteId)
      const ranking = await fetchTrimPlayRanking({ barbershopId, clienteId })
      saveCachedRanking(barbershopId, { top: ranking.top, my: ranking.my })
      setMyRanking(ranking.my ? { rank: ranking.my.rank, score: ranking.my.score } : null)
      setSyncError(null)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Erro ao sincronizar")
    }
  }

  const submitProgress = useCallback(
    async (deltaScore: number) => {
      if (deltaScore <= 0) return
      if (navigator.onLine) {
        try {
          await submitTrimPlayScore({
            barbershopId,
            clienteId,
            clienteName: clienteNome,
            score: deltaScore,
          })
          await refreshMyRanking()
          setSyncError(null)
        } catch (e) {
          savePendingScore(barbershopId, clienteId, deltaScore)
          setSyncError(e instanceof Error ? e.message : "Sem conexão para sincronizar")
        }
      } else {
        savePendingScore(barbershopId, clienteId, deltaScore)
        setSyncError("Sem internet: pontuação será enviada quando voltar.")
      }
    },
    [barbershopId, clienteId, clienteNome, refreshMyRanking]
  )

  useEffect(() => {
    const run = () => void syncPending()
    window.addEventListener("online", run)
    void syncPending()
    return () => window.removeEventListener("online", run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbershopId, clienteId])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1600)
  }, [])
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

  const visualEffectDurationMs = (effectKey: VisualEffectKey) => {
    switch (effectKey) {
      case "efeito_texto":
        return 900
      case "efeito_brilho":
        return 650
      case "efeito_tremer":
        return 450
      case "efeito_flash":
        return 480
      case "efeito_particulas":
        return 650
      case "efeito_explosao":
        return 780
      case "efeito_raio":
        return 520
      case "efeito_escurecer":
        return 700
      default:
        return 500
    }
  }

  const visualsFetchPromiseRef = useRef<Promise<void> | null>(null)

  const unlockVisualEffects = useCallback(async () => {
    if (visualsLoadedRef.current) return
    if (visualsFetchPromiseRef.current) {
      await visualsFetchPromiseRef.current
      return
    }
    visualsFetchPromiseRef.current = (async () => {
      const applyFallback = () => setVisualEvents(FALLBACK_VISUAL_EVENTS)
      try {
        const r = await fetch("/api/trimplay/visual-effects", { credentials: "include" })
        const j = await r.json().catch(() => ({}))
        const categories = (j?.categories ?? {}) as Partial<Record<VisualEventKey, VisualEffectAsset[]>>

        const allEmpty =
          (categories.combo1?.length ?? 0) === 0 &&
          (categories.combo2?.length ?? 0) === 0 &&
          (categories.combo3?.length ?? 0) === 0 &&
          (categories.combo4?.length ?? 0) === 0 &&
          (categories.victory?.length ?? 0) === 0 &&
          (categories.gameover?.length ?? 0) === 0

        if (allEmpty) {
          applyFallback()
          visualsLoadedRef.current = true
          return
        }

        setVisualEvents({
          combo1: normalizeVisualAssets(categories.combo1),
          combo2: normalizeVisualAssets(categories.combo2),
          combo3: normalizeVisualAssets(categories.combo3),
          combo4: normalizeVisualAssets(categories.combo4),
          victory: normalizeVisualAssets(categories.victory),
          gameover: normalizeVisualAssets(categories.gameover),
        })
        visualsLoadedRef.current = true
      } catch {
        applyFallback()
        visualsLoadedRef.current = true
      } finally {
        visualsFetchPromiseRef.current = null
      }
    })()
    await visualsFetchPromiseRef.current
  }, [])

  useEffect(() => {
    void unlockVisualEffects()
  }, [unlockVisualEffects])

  const triggerVisualEvent = useCallback(
    (eventKey: VisualEventKey, ctx?: { comboLevel?: number }) => {
      const list = visualEventsRef.current[eventKey] ?? []
      if (!list.length) return

      const idx = visualIdxRef.current[eventKey] % list.length
      visualIdxRef.current[eventKey] += 1

      const effectKey = toVisualEffectKey(list[idx]?.effectKey)
      if (!effectKey) return
      const token = Date.now() + Math.random()

      const durationMs = visualEffectDurationMs(effectKey)

      let text: string | undefined
      if (effectKey === "efeito_texto") {
        if (eventKey === "victory") text = "AUGE!"
        else if (eventKey === "gameover") text = "GAME OVER"
        else if (eventKey.startsWith("combo")) text = `Combo x${ctx?.comboLevel ?? 1}`
      }

      if (effectKey === "efeito_particulas" || effectKey === "efeito_explosao") {
        const count = effectKey === "efeito_explosao" ? 18 : 12
        const baseHue = Math.floor(Math.random() * 50) + 35
        const particles: Particle[] = Array.from({ length: count }).map((_, i) => {
          const a = Math.random() * Math.PI * 2
          const dist = effectKey === "efeito_explosao" ? 18 + Math.random() * 28 : 12 + Math.random() * 22
          const x1Pct = 50 + (Math.random() * 6 - 3)
          const y1Pct = 50 + (Math.random() * 6 - 3)
          const x2Pct = Math.max(5, Math.min(95, x1Pct + Math.cos(a) * dist))
          const y2Pct = Math.max(5, Math.min(95, y1Pct + Math.sin(a) * dist))
          return {
            id: `${eventKey}_${token}_${i}`,
            sizePx: effectKey === "efeito_explosao" ? 6 + Math.random() * 6 : 4 + Math.random() * 5,
            x1Pct,
            y1Pct,
            x2Pct,
            y2Pct,
            delayMs: Math.floor(Math.random() * 90),
            hue: baseHue + Math.random() * 20,
          }
        })
        setVisualEffectActive({ effectKey, token, text, particles, rayHue: 45 })
        window.setTimeout(() => {
          setVisualEffectActive((cur) => (cur?.token === token ? null : cur))
        }, durationMs + 60)
        return
      }

      if (effectKey === "efeito_tremer") {
        setVisualEffectActive({ effectKey, token })
        window.setTimeout(() => {
          setVisualEffectActive((cur) => (cur?.token === token ? null : cur))
        }, durationMs)
        return
      }

      // flash, raio, escurecer e texto ficam como overlays fixos
      if (effectKey === "efeito_raio") {
        setVisualEffectActive({ effectKey, token, text, rayHue: Math.floor(40 + Math.random() * 40) })
      } else {
        setVisualEffectActive({ effectKey, token, text })
      }
      window.setTimeout(() => {
        setVisualEffectActive((cur) => (cur?.token === token ? null : cur))
      }, durationMs + 60)
    },
    [visualEffectDurationMs]
  )

  const endGame = useCallback(
    async (finalScore: number) => {
      setState("over")
      window.setTimeout(() => playTrimPlayGameOver(), 240)
      triggerVisualEvent("gameover")
      const storedBest = loadBestLocal(barbershopId, clienteId)
      if (finalScore > storedBest) {
        setBestLocal(finalScore)
        saveBestLocal(barbershopId, clienteId, finalScore)
      }
      const pendingRound = unsyncedRoundPointsRef.current
      unsyncedRoundPointsRef.current = 0
      await submitProgress(pendingRound)
    },
    [barbershopId, clienteId, submitProgress, triggerVisualEvent]
  )

  const updatePreview = useCallback((clientX: number, clientY: number, d: DragPayload) => {
    const grid = boardGridRef.current
    if (!grid) {
      setDropPreview(null)
      return
    }
    const shapeLeft = clientX - d.offsetX
    const shapeTop = clientY - d.offsetY
    const anchor = pickDropAnchor(shapeLeft, shapeTop, grid, d.piece.cells, boardRef.current)
    if (!anchor) {
      setDropPreview(null)
      return
    }
    const { ar, ac } = anchor
    setDropPreview({ ar, ac, ok: true })
  }, [])

  const commitPlacement = useCallback(
    async (slot: number, piece: HandPiece, ar: number, ac: number) => {
      if (stateRef.current !== "playing") return

      const boardNow = boardRef.current
      const handNow = handRef.current
      const scoreNow = scoreRef.current
      const movesNow = movesRef.current

      if (!canPlace(boardNow, piece.cells, ar, ac)) {
        showToast("Não cabe aqui")
        return
      }

      unlockTrimPlayAudio()
      playTrimPlayPlace()

      const next = placePiece(boardNow, piece.cells, ar, ac, piece.hue)
      const { board: afterClear, cellsCleared, linesTotal, rounds } = resolveClears(next)
      const clearedThisMove = linesTotal > 0
      const boardJustCleared = isBoardEmpty(afterClear)
      const nextCombo = clearedThisMove ? comboStreakRef.current + 1 : 0
      setComboStreak(nextCombo)

      if (clearedThisMove) {
        const comboAudioLevel = Math.max(1, Math.min(4, Math.max(nextCombo, rounds)))
        playTrimPlayCombo(comboAudioLevel)
        const comboEventKey: VisualEventKey =
          nextCombo >= 4 ? "combo4" : nextCombo === 3 ? "combo3" : nextCombo === 2 ? "combo2" : "combo1"
        triggerVisualEvent(comboEventKey, { comboLevel: Math.max(1, Math.min(4, nextCombo)) })
        if (nextCombo >= 2) showToast(`${nextCombo}x combo`)
      }
      if (boardJustCleared) {
        playTrimPlayVictory()
        triggerVisualEvent("victory")
        showToast("AUGE! Tabuleiro limpo!")
        setPeakBanner(true)
        window.setTimeout(() => setPeakBanner(false), 1700)
      }

      const placePoints = piece.cells.length * 3
      const clearPoints = clearedThisMove ? cellsCleared * 12 + linesTotal * 90 : 0
      const multiLineBonus = linesTotal >= 2 ? linesTotal * 70 : 0
      const comboBonus = clearedThisMove ? Math.max(0, nextCombo - 1) * 55 + (nextCombo >= 3 ? nextCombo * 20 : 0) : 0
      const boardClearBonus = boardJustCleared ? 320 : 0
      const points = placePoints + clearPoints + multiLineBonus + comboBonus + boardClearBonus
      unsyncedRoundPointsRef.current += points
      const nextScore = scoreNow + points
      const nextMoves = movesNow + 1

      const newHand = handNow.slice() as (HandPiece | null)[]
      newHand[slot] = null

      let filledHand = newHand
      if (newHand.every((x) => x === null)) {
        const roundDelta = unsyncedRoundPointsRef.current
        unsyncedRoundPointsRef.current = 0
        void submitProgress(roundDelta)
        const nextLines = linesLifetime + linesTotal
        const nextMaxCombo = clearedThisMove ? Math.max(maxComboEver, nextCombo) : maxComboEver
        if (clearedThisMove) setMaxComboEver((m) => Math.max(m, nextCombo))
        if (linesTotal > 0) setLinesLifetime((l) => l + linesTotal)

        filledHand = dealHand(
          afterClear,
          {
            score: nextScore,
            linesLifetime: nextLines,
            maxComboEver: nextMaxCombo,
          },
          recentTemplatesRef.current
        )
        recentTemplatesRef.current = [...recentTemplatesRef.current, ...filledHand.filter(Boolean).map((x) => x!.templateId)].slice(
          -8
        )
        if (!canPlaceAnyPiece(afterClear, filledHand)) {
          setBoard(afterClear)
          setHand(filledHand)
          setScore(nextScore)
          setMoves(nextMoves)
          await endGame(nextScore)
          return
        }
      }

      setBoard(afterClear)
      setHand(filledHand)
      setScore(nextScore)
      setMoves(nextMoves)

      if (!canPlaceAnyPiece(afterClear, filledHand)) {
        await endGame(nextScore)
      }
    },
    [endGame, showToast, submitProgress, triggerVisualEvent, linesLifetime, maxComboEver]
  )

  const updatePreviewRef = useRef(updatePreview)
  const commitPlacementRef = useRef(commitPlacement)
  updatePreviewRef.current = updatePreview
  commitPlacementRef.current = commitPlacement

  const onPiecePointerDown = useCallback((e: React.PointerEvent, slot: number) => {
    if (stateRef.current !== "playing") return
    const piece = handRef.current[slot]
    if (!piece) return

    e.preventDefault()
    e.stopPropagation()
    unlockTrimPlayAudio()
    void unlockVisualEffects()

    const el = e.currentTarget as HTMLElement
    try {
      el.setPointerCapture(e.pointerId)
      pointerCaptureRef.current = { el, id: e.pointerId }
    } catch {
      pointerCaptureRef.current = null
    }
    if (typeof document !== "undefined") {
      document.body.style.touchAction = "none"
      document.documentElement.style.touchAction = "none"
      document.documentElement.style.overscrollBehavior = "none"
    }
    const shapeEl = el.querySelector("[data-trimplay-shape]") as HTMLElement | null
    const rect = (shapeEl ?? el).getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    const payload: DragPayload = {
      slot,
      piece,
      offsetX,
      offsetY,
      x: e.clientX,
      y: e.clientY,
    }
    dragRef.current = payload
    setDrag(payload)
    updatePreviewRef.current(e.clientX, e.clientY, payload)

    const pointerId = e.pointerId
    let capturedOk = pointerCaptureRef.current !== null

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const d = dragRef.current
      if (!d) return
      ev.preventDefault()
      const next = { ...d, x: ev.clientX, y: ev.clientY }
      dragRef.current = next
      setDrag(next)
      updatePreviewRef.current(ev.clientX, ev.clientY, next)
    }

    const releaseDragChrome = () => {
      const cap = pointerCaptureRef.current
      pointerCaptureRef.current = null
      if (cap) {
        try {
          cap.el.releasePointerCapture(cap.id)
        } catch {
          /* ignore */
        }
      }
      if (typeof document !== "undefined") {
        document.body.style.touchAction = ""
        document.documentElement.style.touchAction = ""
        document.documentElement.style.overscrollBehavior = ""
      }
    }

    const detachPointerListeners = () => {
      if (capturedOk) {
        el.removeEventListener("pointermove", onMove, POINTER_MOVE_OPTS)
        el.removeEventListener("pointerup", onUp)
        el.removeEventListener("pointercancel", onUp)
      } else {
        window.removeEventListener("pointermove", onMove, POINTER_MOVE_OPTS)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
      }
      dragPointerListenersCleanupRef.current = null
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      detachPointerListeners()
      releaseDragChrome()

      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      setDropPreview(null)

      if (!d || stateRef.current !== "playing") return

      const grid = boardGridRef.current
      if (!grid) return

      const shapeLeft = ev.clientX - d.offsetX
      const shapeTop = ev.clientY - d.offsetY
      const gr = grid.getBoundingClientRect()
      const overBoard =
        ev.clientX >= gr.left && ev.clientX <= gr.right && ev.clientY >= gr.top && ev.clientY <= gr.bottom

      if (!overBoard) return

      const anchor = pickDropAnchor(shapeLeft, shapeTop, grid, d.piece.cells, boardRef.current)
      if (!anchor) {
        showToastRef.current("Não encaixa aqui — aproxime o canto da peça da grade")
        return
      }

      void commitPlacementRef.current(d.slot, d.piece, anchor.ar, anchor.ac)
    }

    /**
     * Com setPointerCapture, pointermove/up/cancel são entregues ao elemento que capturou — não à window.
     * Sem isso, no iOS/Android o arrasto nunca “solta” e a peça não encaixa.
     */
    dragPointerListenersCleanupRef.current = detachPointerListeners
    if (capturedOk) {
      el.addEventListener("pointermove", onMove, POINTER_MOVE_OPTS)
      el.addEventListener("pointerup", onUp)
      el.addEventListener("pointercancel", onUp)
    } else {
      window.addEventListener("pointermove", onMove, POINTER_MOVE_OPTS)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
    }
  }, [])

  const reset = () => {
    dragPointerListenersCleanupRef.current?.()
    dragPointerListenersCleanupRef.current = null
    const cap = pointerCaptureRef.current
    pointerCaptureRef.current = null
    if (cap) {
      try {
        cap.el.releasePointerCapture(cap.id)
      } catch {
        /* ignore */
      }
    }
    if (typeof document !== "undefined") {
      document.body.style.touchAction = ""
      document.documentElement.style.touchAction = ""
      document.documentElement.style.overscrollBehavior = ""
    }
    setBoard(emptyBoard())
    const freshBoard = emptyBoard()
    const freshHand = dealHand(freshBoard, { score: 0, linesLifetime: 0, maxComboEver: 0 }, [])
    recentTemplatesRef.current = freshHand.filter(Boolean).map((x) => x!.templateId)
    setHand(freshHand)
    setScore(0)
    setLinesLifetime(0)
    setMaxComboEver(0)
    setMoves(0)
    setComboStreak(0)
    setState("playing")
    setSyncError(null)
    setToast(null)
    setDrag(null)
    setDropPreview(null)
    dragRef.current = null
    unsyncedRoundPointsRef.current = 0
  }

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] max-h-[100dvh] text-white flex flex-col overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 100% 55% at 50% -12%, rgba(212, 175, 55, 0.16), transparent 50%), radial-gradient(ellipse 65% 40% at 95% 35%, rgba(70, 55, 18, 0.14), transparent), linear-gradient(180deg, #0f0f0f 0%, #080808 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-36 -z-10 bg-gradient-to-b from-amber-500/14 via-amber-600/5 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-32 -z-10 bg-gradient-to-t from-amber-600/10 via-amber-500/4 to-transparent"
      />

      {syncError ? (
        <div className="relative z-10 max-w-xl mx-auto w-full px-4 pt-4">
          <div className="text-sm text-red-200 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3">
            {syncError}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed left-1/2 -translate-x-1/2 z-[2147483647] max-w-[min(100%-2rem,24rem)] px-4 py-2.5 rounded-xl bg-[#141414]/95 border border-[#c9a227]/45 text-sm text-white/95 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md top-[max(4.5rem,env(safe-area-inset-top)+3rem)]">
          {toast}
        </div>
      ) : null}

      {peakBanner ? (
        <div className="fixed inset-0 z-[2147483644] pointer-events-none flex items-center justify-center px-6">
          <div className="rounded-2xl border border-amber-300/70 bg-black/78 backdrop-blur-md px-7 py-5 shadow-[0_0_42px_rgba(245,158,11,0.45)] animate-in zoom-in-95 fade-in duration-200">
            <p className="text-amber-200 text-xs tracking-[0.28em] text-center">MOMENTO</p>
            <p className="text-[#ffd86b] text-3xl sm:text-4xl font-extrabold tracking-wide text-center drop-shadow-[0_0_18px_rgba(245,158,11,0.7)]">
              AUGE!
            </p>
            <p className="text-white/85 text-sm text-center mt-1">Tabuleiro limpo</p>
          </div>
        </div>
      ) : null}

      {visualEffectActive?.effectKey === "efeito_texto" && visualEffectActive.text ? (
        <div className="fixed inset-0 z-[2147483645] pointer-events-none flex items-center justify-center px-6">
          <div
            key={visualEffectActive.token}
            className="rounded-2xl border border-amber-300/70 bg-black/78 backdrop-blur-md px-7 py-4 shadow-[0_0_42px_rgba(245,158,11,0.25)] animate-in zoom-in-95 fade-in duration-200"
          >
            <p className="text-[#ffd86b] text-3xl sm:text-4xl font-extrabold tracking-wide text-center drop-shadow-[0_0_18px_rgba(245,158,11,0.7)]">
              {visualEffectActive.text}
            </p>
          </div>
        </div>
      ) : null}

      {visualEffectActive?.effectKey === "efeito_flash" ? (
        <div
          key={visualEffectActive.token}
          className="fixed inset-0 z-[2147483646] pointer-events-none bg-gradient-to-b from-white/55 via-amber-100/25 to-transparent trimplay-viz-flash mix-blend-screen"
          style={{ ["--dur" as any]: `${visualEffectDurationMs("efeito_flash")}ms` } as CSSProperties}
        />
      ) : null}

      {visualEffectActive?.effectKey === "efeito_escurecer" ? (
        <div
          key={visualEffectActive.token}
          className="fixed inset-0 z-[2147483643] pointer-events-none bg-black/70 trimplay-viz-darken"
          style={{ ["--dur" as any]: `${visualEffectDurationMs("efeito_escurecer")}ms` } as CSSProperties}
        />
      ) : null}

      {visualEffectActive?.effectKey === "efeito_raio" ? (
        <div
          key={visualEffectActive.token}
          className="fixed inset-0 z-[2147483643] pointer-events-none trimplay-viz-ray"
          style={
            {
              ["--dur" as any]: `${visualEffectDurationMs("efeito_raio")}ms`,
              background: "linear-gradient(115deg, rgba(255,212,107,0) 30%, rgba(255,212,107,0.55) 50%, rgba(255,212,107,0) 70%)",
              mixBlendMode: "screen",
            } as CSSProperties
          }
        />
      ) : null}

      {drag ? (
        <div
          className="fixed z-[2147483645] pointer-events-none"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.65))",
          }}
          aria-hidden
        >
          <ShapePreview cells={drag.piece.cells} hue={drag.piece.hue} cellPx={ghostCellPx} gapPx={ghostGapPx} />
        </div>
      ) : null}

      {rankingOpen ? (
        <div
          className="fixed inset-0 z-[2147483640] flex flex-col bg-[#050504]/96 backdrop-blur-xl animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trimplay-ranking-title"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 border-b border-[#5c4d22]/50 bg-black/20">
            <div className="flex items-center gap-3 min-w-0" id="trimplay-ranking-title">
              <div className="w-10 h-10 rounded-xl border border-[#c9a227]/45 bg-gradient-to-br from-[#2a2418] to-[#12100c] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.15)]">
                <Trophy className="w-5 h-5 text-[#f0d060]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Ranking</h2>
                <p className="text-xs text-white/45">Top jogadores desta barbearia</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRankingOpen(false)}
              className="shrink-0 p-3 rounded-xl border border-[#6b5a28]/55 text-[#e8c547] hover:bg-white/5 transition-colors"
              aria-label="Fechar ranking"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col">
            <TrimPlayRankingPanel
              barbershopId={barbershopId}
              clienteId={clienteId}
              variant="fullscreen"
              header={
                <div className="flex items-center gap-2 text-[#f0d060]">
                  <span className="font-semibold">Ranking</span>
                  <span className="text-white/35 text-sm font-normal">· todos os jogadores</span>
                </div>
              }
            />
          </div>
        </div>
      ) : null}

      <header className="relative z-20 shrink-0 flex items-center gap-2 px-2 sm:px-3 pt-[max(0.25rem,env(safe-area-inset-top))] pb-2 border-b border-[#3d3520]/55 bg-[#080807]/85 backdrop-blur-md">
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-[14px] sm:text-base text-white/80 tabular-nums leading-tight truncate mt-0.5">
            <span className="inline-flex items-center gap-1.5 text-[#f0d060] font-semibold drop-shadow-[0_0_6px_rgba(240,208,96,0.25)]">
              <Trophy className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              <span className="tracking-[0.02em]">#{myRanking?.rank ?? "--"}</span>
            </span>
            <span className="text-white/40"> · </span>
            <span className="font-semibold text-white/90">{myRanking?.score ?? bestLocal}</span>
            <span className="text-white/45 text-[12px] sm:text-sm ml-1">pts</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              unlockTrimPlayAudio()
              setRankingOpen(true)
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-[#b8860b]/50 bg-black/35 text-[10px] sm:text-xs text-[#f5d78a] hover:bg-amber-500/10 transition-colors"
            aria-label="Abrir ranking"
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden min-[360px]:inline">Ranking</span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-[#7a6828]/60 text-[11px] sm:text-xs text-[#f5e6a8] hover:bg-white/5 transition-colors"
          >
            Voltar
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-lg border border-[#8a7328]/55 bg-black/40 text-[#e8c547] hover:bg-[#ffd700]/10 transition-colors"
                aria-label="Mais opções"
              >
                <Settings className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="z-[300] w-52 border-[#5c4d22] bg-[#12100c] text-white shadow-xl"
            >
              <DropdownMenuItem className="focus:bg-[#2a2418] focus:text-[#f0d060] cursor-pointer" onSelect={() => reset()}>
                {state === "over" ? "Jogar de novo" : "Reiniciar partida"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3d3520]" />
              <DropdownMenuCheckboxItem
                className="focus:bg-[#2a2418] focus:text-[#f0d060]"
                checked={!soundMuted}
                onCheckedChange={(somLigado) => {
                  setTrimPlayMuted(!somLigado)
                  setSoundMuted(!somLigado)
                }}
              >
                Som ligado
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="relative z-0 flex-1 min-h-0 flex flex-col w-full max-w-lg mx-auto touch-pan-y pt-7 sm:pt-9">
        <div className="shrink-0 flex justify-center pt-2 sm:pt-3 pb-2 sm:pb-3">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-5xl sm:text-6xl leading-none font-semibold tracking-tight text-white/90 tabular-nums">
              {score}
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/40 text-center leading-tight">
              Fase {phase} · {difficultyUiLabel}
            </span>
            {comboStreak >= 2 ? (
              <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-200 font-semibold">
                Combo x{comboStreak}
              </span>
            ) : null}
          </div>
        </div>
        {/* Tabuleiro quadrado: encaixa na altura/largura úteis do viewport */}
        <div className="shrink-0 flex items-start justify-center px-1 pt-0.5 pb-2 sm:pt-1 sm:pb-2">
          <div
            className="select-none rounded-xl sm:rounded-2xl p-[2px] sm:p-[3px] shrink-0 w-[min(100%,min(92vw,calc(100dvh-11.5rem)))] aspect-square max-w-[min(92vw,calc(100dvh-11.5rem))]"
            style={{
              background: "linear-gradient(145deg, rgba(212,175,55,0.45), rgba(80,60,15,0.5))",
              boxShadow: "0 0 32px rgba(212,175,55,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <div className="rounded-[11px] sm:rounded-[13px] bg-gradient-to-b from-[#0a0a0a] via-[#060606] to-[#030303] h-full w-full p-1 sm:p-2.5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.65)] flex items-center justify-center">
              <div
                key={visualEffectActive?.effectKey === "efeito_tremer" ? visualEffectActive.token : "base"}
                ref={boardGridRef}
                className={[
                  "relative h-full w-full",
                  visualEffectActive?.effectKey === "efeito_brilho" ? "trimplay-viz-glow" : "",
                ].join(" ")}
                style={
                  visualEffectActive?.effectKey === "efeito_brilho"
                    ? ({ ["--dur" as any]: `${visualEffectDurationMs("efeito_brilho")}ms` } as CSSProperties)
                    : undefined
                }
              >
                <div
                  className={[
                    "grid touch-none h-full w-full gap-0.5 sm:gap-1.5",
                    visualEffectActive?.effectKey === "efeito_tremer" ? "trimplay-viz-shake" : "",
                  ].join(" ")}
                  style={{
                    gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
                    ...(visualEffectActive?.effectKey === "efeito_tremer"
                      ? ({ ["--dur" as any]: `${visualEffectDurationMs("efeito_tremer")}ms` } as any)
                      : {}),
                  }}
                >
                  {board.map((row, r) =>
                    row.map((cell, c) => {
                      const hs = cell ? HUE_STYLES[cell.hue % HUE_STYLES.length]! : null
                      const inPreview =
                        dropPreview &&
                        drag?.piece.cells.some((p) => p.r + dropPreview.ar === r && p.c + dropPreview.ac === c)
                      const previewClass = inPreview
                        ? dropPreview.ok
                          ? "ring-1 sm:ring-2 ring-emerald-400/95 ring-offset-1 sm:ring-offset-2 ring-offset-[#050505] bg-emerald-500/28 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                          : "ring-1 sm:ring-2 ring-red-500/85 ring-offset-1 sm:ring-offset-2 ring-offset-[#050505] bg-red-500/2"
                        : ""

                      return (
                        <div
                          key={`${r}_${c}`}
                          data-board-cell
                          data-br={r}
                          data-bc={c}
                          className={[
                            "min-h-0 min-w-0 rounded-[5px] sm:rounded-[10px] border transition-all duration-150 ease-out",
                            !cell
                              ? "bg-gradient-to-br from-[#1c1c1c] to-[#0e0e0e] border-[#2e2818]/95 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55)]"
                              : "",
                            !cell ? previewClass : "",
                          ].join(" ")}
                          style={
                            hs
                              ? {
                                  ...glossyBlockStyle(hs),
                                  borderWidth: 1,
                                  borderStyle: "solid",
                                }
                              : undefined
                          }
                          aria-label={`Célula ${r + 1},${c + 1}`}
                        />
                      )
                    })
                  )}
                </div>

                {(visualEffectActive?.effectKey === "efeito_particulas" || visualEffectActive?.effectKey === "efeito_explosao") &&
                visualEffectActive.particles?.length ? (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {visualEffectActive.particles.map((p) => {
                      const durationMs = visualEffectDurationMs(visualEffectActive.effectKey)
                      return (
                        <div
                          key={p.id}
                          className="trimplay-particle-fly"
                          style={
                            {
                              left: `${p.x1Pct}%`,
                              top: `${p.y1Pct}%`,
                              ["--x1" as any]: `${p.x1Pct}%`,
                              ["--y1" as any]: `${p.y1Pct}%`,
                              ["--x2" as any]: `${p.x2Pct}%`,
                              ["--y2" as any]: `${p.y2Pct}%`,
                              ["--size" as any]: `${p.sizePx}px`,
                              ["--h" as any]: `${p.hue}`,
                              ["--delay" as any]: `${p.delayMs}ms`,
                              ["--dur" as any]: `${durationMs}ms`,
                            } as CSSProperties
                          }
                        />
                      )
                    })}
                  </div>
                ) : null}

                {visualEffectActive?.effectKey === "efeito_explosao" ? (
                  <div
                    className="trimplay-explosion-ring"
                    style={{ ["--dur" as any]: `${visualEffectDurationMs("efeito_explosao")}ms` } as CSSProperties}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 h-5 sm:h-8" />

        {/* Três peças sempre na mesma linha; altura fixa enxuta */}
        <section className="shrink-0 mt-[5mm] border-t border-[#3d3520]/50 bg-[#060605]/90 px-1.5 sm:px-3 pt-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-nowrap justify-center items-stretch gap-1 sm:gap-2 max-w-md mx-auto w-full">
            {hand.map((piece, slot) => {
              if (!piece) {
                return (
                  <div
                    key={`empty_${slot}`}
                    className="flex-1 min-w-0 max-w-[32vw] sm:max-w-[7.5rem] h-[4.75rem] sm:h-[6.75rem] rounded-lg border border-dashed border-[#4a4020]/65 bg-[#080807]/90 flex items-center justify-center text-white/15 text-[10px] sm:text-xs"
                  >
                    —
                  </div>
                )
              }
              const draggingThis = drag?.slot === slot
              return (
                <div
                  key={piece.id}
                  role="presentation"
                  onPointerDown={(e) => onPiecePointerDown(e, slot)}
                  className={[
                    "flex-1 min-w-0 max-w-[32vw] sm:max-w-[7.5rem] h-[4.75rem] sm:h-[6.75rem] rounded-lg border transition-all duration-200 flex items-center justify-center p-1 sm:p-2 touch-none cursor-grab active:cursor-grabbing select-none",
                    draggingThis
                      ? "opacity-35 border-[#5c4d22]/35 scale-[0.98]"
                      : "border-[#8a7328]/45 bg-gradient-to-b from-[#15130e] to-[#080807] shadow-[inset_0_1px_0_rgba(255,215,0,0.06)]",
                  ].join(" ")}
                  style={{ touchAction: "none" }}
                >
                  <ShapePreview
                    cells={piece.cells}
                    hue={piece.hue}
                    cellPx={trayCellPx}
                    gapPx={trayGapPx}
                    dimmed={draggingThis}
                  />
                </div>
              )
            })}
          </div>
          <p className="hidden sm:block mt-2 text-center text-[11px] text-white/40 leading-snug px-1">
            Arraste até o quadro. Preview verde = encaixa. Linhas e colunas cheias somem.
          </p>
        </section>
      </main>

      {state === "over" ? (
        <div className="fixed inset-0 z-[2147483646] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border border-[#9a7b2d]/55 p-6 sm:p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_32px_90px_rgba(0,0,0,0.65)]"
            style={{
              background: "linear-gradient(165deg, #141210 0%, #0a0a08 100%)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-[#8a7a50] mb-2">Fim de rodada</p>
            <h2 className="text-[#f0d878] font-bold text-2xl sm:text-3xl mb-3">Game over</h2>
            <p className="text-white/75 text-sm">
              Pontuação: <span className="font-semibold text-[#f0d060] tabular-nums text-lg">{score}</span>
            </p>
            <p className="mt-4 text-white/55 text-sm leading-relaxed">
              {syncError ? syncError : "Seu resultado entra no ranking quando a conexão permitir."}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={reset}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-b from-[#f0d060] to-[#c9a227] text-black font-semibold hover:opacity-95 transition-opacity shadow-lg"
              >
                Jogar de novo
              </button>
              <button
                type="button"
                onClick={onExit}
                className="px-4 py-3 rounded-xl border border-[#7a6828]/55 text-[#e8c547] font-medium hover:bg-white/5 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
