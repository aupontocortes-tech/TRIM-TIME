"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { Trophy, Volume2, VolumeX, X } from "lucide-react"
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
  setTrimPlayMuted,
  unlockTrimPlayAudio,
} from "./trimPlayHowler"

const SIZE = 8

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
type HandPiece = { id: string; cells: ShapeCell[]; hue: number }

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

function randomPiece(): HandPiece {
  const cells = SHAPE_TEMPLATES[Math.floor(Math.random() * SHAPE_TEMPLATES.length)]!
  const hue = Math.floor(Math.random() * 6)
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    cells: [...cells],
    hue,
  }
}

function dealHand(): (HandPiece | null)[] {
  return [randomPiece(), randomPiece(), randomPiece()]
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
 * Entre todos os encaixes válidos, escolhe o que alinha melhor o canto da peça (em pixels).
 * Tolerância ~0,75 célula: corrige subpixel, padding e diferença ghost/tabuleiro sem “teleportar” a peça.
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
  const maxSlop = Math.min(m.stepX, m.stepY) * 0.95
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
  const [hand, setHand] = useState<(HandPiece | null)[]>(() => dealHand())
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
  const [state, setState] = useState<"playing" | "over">("playing")
  const [toast, setToast] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [dropPreview, setDropPreview] = useState<{ ar: number; ac: number; ok: boolean } | null>(null)

  const [bestLocal, setBestLocal] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)

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

  boardRef.current = board
  handRef.current = hand
  scoreRef.current = score
  movesRef.current = moves
  stateRef.current = state
  dragRef.current = drag

  useEffect(() => {
    const best = loadBestLocal(barbershopId, clienteId)
    setBestLocal(best)
  }, [barbershopId, clienteId])

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
      setSyncError(null)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Erro ao sincronizar")
    }
  }

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

  const endGame = useCallback(
    async (finalScore: number) => {
      setState("over")
      window.setTimeout(() => playTrimPlayGameOver(), 240)
      const storedBest = loadBestLocal(barbershopId, clienteId)
      if (finalScore > storedBest) {
        setBestLocal(finalScore)
        saveBestLocal(barbershopId, clienteId, finalScore)
        if (navigator.onLine) {
          try {
            await submitTrimPlayScore({
              barbershopId,
              clienteId,
              clienteName: clienteNome,
              score: finalScore,
            })
            clearPendingScore(barbershopId, clienteId)
            const ranking = await fetchTrimPlayRanking({ barbershopId, clienteId })
            saveCachedRanking(barbershopId, { top: ranking.top, my: ranking.my })
            setSyncError(null)
          } catch (e) {
            savePendingScore(barbershopId, clienteId, finalScore)
            setSyncError(e instanceof Error ? e.message : "Sem conexão para sincronizar")
          }
        } else {
          savePendingScore(barbershopId, clienteId, finalScore)
          setSyncError("Sem internet: pontuação será enviada quando voltar.")
        }
      }
    },
    [barbershopId, clienteId, clienteNome]
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

      if (cellsCleared > 0) {
        if (rounds >= 2) playTrimPlayCombo(rounds)
        else playTrimPlayLineClear()
      }

      const points =
        cellsCleared > 0 ? cellsCleared * 15 + linesTotal * 80 + (linesTotal >= 2 ? 120 : 0) : piece.cells.length * 2
      const nextScore = scoreNow + points
      const nextMoves = movesNow + 1

      const newHand = handNow.slice() as (HandPiece | null)[]
      newHand[slot] = null

      let filledHand = newHand
      if (newHand.every((x) => x === null)) {
        filledHand = dealHand()
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
    [endGame, showToast]
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

    const el = e.currentTarget as HTMLElement
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

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const next = { ...d, x: ev.clientX, y: ev.clientY }
      dragRef.current = next
      setDrag(next)
      updatePreviewRef.current(ev.clientX, ev.clientY, next)
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)

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

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }, [])

  const reset = () => {
    setBoard(emptyBoard())
    setHand(dealHand())
    setScore(0)
    setMoves(0)
    setState("playing")
    setSyncError(null)
    setToast(null)
    setDrag(null)
    setDropPreview(null)
    dragRef.current = null
  }

  return (
    <div className="relative min-h-screen text-white flex flex-col overflow-x-hidden">
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2147483647] max-w-[min(100%-2rem,24rem)] px-4 py-2.5 rounded-xl bg-[#141414]/95 border border-[#c9a227]/45 text-sm text-white/95 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          {toast}
        </div>
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
          <ShapePreview cells={drag.piece.cells} hue={drag.piece.hue} cellPx={22} gapPx={3} />
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
                  <span className="font-semibold">Top 10</span>
                  <span className="text-white/35 text-sm font-normal">· melhores pontuações</span>
                </div>
              }
            />
          </div>
        </div>
      ) : null}

      <main className="relative z-0 flex-1 flex flex-col px-3 sm:px-4 py-4 pb-12 max-w-xl mx-auto w-full gap-4">
        <section
          className="relative overflow-hidden rounded-2xl border border-[#a68b2e]/50 bg-[#0b0b0a]/95 p-4 sm:p-5 backdrop-blur-sm"
          style={{
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.7), 0 20px 64px rgba(0,0,0,0.55), 0 0 80px rgba(212,175,55,0.06), inset 0 1px 0 rgba(255,215,0,0.09)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-400/10 to-transparent rounded-t-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-amber-500/8 to-transparent rounded-b-2xl"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-3 gap-y-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 shrink-0 rounded-xl border border-[#d4af37]/55 bg-gradient-to-br from-[#3d3318] via-[#1f1a0d] to-[#0c0b08] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,220,120,0.25),0_0_24px_rgba(212,175,55,0.2)]">
                <span className="text-[#ffdf6b] text-2xl font-black leading-none drop-shadow-[0_0_8px_rgba(255,215,0,0.45)]">
                  ▦
                </span>
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-semibold text-xl sm:text-2xl tracking-tight leading-tight">
                  Trim Play
                </h1>
                <p className="text-[#e0b84a] text-sm mt-0.5">
                  {state === "over" ? "Fim de jogo" : "Arraste até o tabuleiro"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  unlockTrimPlayAudio()
                  setRankingOpen(true)
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#b8860b]/55 bg-black/35 text-[#f5d78a] text-sm font-medium hover:bg-amber-500/10 hover:border-[#d4af37]/55 transition-colors shadow-[0_0_20px_rgba(212,175,55,0.06)]"
              >
                <Trophy className="w-4 h-4" />
                Ranking
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2.5 rounded-xl border border-[#9a7b2d]/55 text-[#e8c547] text-sm font-medium hover:bg-[#ffd700]/8 transition-colors"
              >
                {state === "over" ? "Jogar de novo" : "Reiniciar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !soundMuted
                  setTrimPlayMuted(next)
                  setSoundMuted(next)
                }}
                className="p-2.5 rounded-xl border border-[#6b5a28]/55 bg-black/30 text-[#e8c547] hover:bg-[#ffd700]/10 transition-colors"
                aria-label={soundMuted ? "Ativar som" : "Silenciar"}
              >
                {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="px-4 py-2.5 rounded-xl border border-[#5c4d22]/55 text-white/80 text-sm hover:bg-white/5 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/55 mb-5 pb-4 border-b border-[#3d3520]/70">
            <span>
              Melhor: <span className="text-[#f0d060] font-semibold tabular-nums">{bestLocal}</span>
            </span>
            <span className="text-white/25">·</span>
            <span>
              Jogadas: <span className="text-white/80 tabular-nums">{moves}</span>
            </span>
            <span className="text-white/25">·</span>
            <span>
              Pontos: <span className="text-[#e8c547] font-semibold tabular-nums">{score}</span>
            </span>
          </div>

          <div className="relative flex justify-center">
            <div
              className="select-none rounded-2xl p-[3px] w-fit"
              style={{
                background: "linear-gradient(145deg, rgba(212,175,55,0.45), rgba(80,60,15,0.5))",
                boxShadow: "0 0 48px rgba(212,175,55,0.12), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              <div className="rounded-[13px] bg-gradient-to-b from-[#0a0a0a] via-[#060606] to-[#030303] p-3 sm:p-4 shadow-[inset_0_2px_24px_rgba(0,0,0,0.65)]">
                <div
                  ref={boardGridRef}
                  className="grid gap-1 sm:gap-1.5 mx-auto w-fit touch-none"
                  style={{
                    gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
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
                          ? "ring-2 ring-emerald-400/95 ring-offset-2 ring-offset-[#050505] bg-emerald-500/28 shadow-[0_0_22px_rgba(52,211,153,0.35)]"
                          : "ring-2 ring-red-500/85 ring-offset-2 ring-offset-[#050505] bg-red-500/2"
                        : ""

                      return (
                        <div
                          key={`${r}_${c}`}
                          data-board-cell
                          data-br={r}
                          data-bc={c}
                          className={[
                            "aspect-square w-[min(11vw,48px)] sm:w-12 rounded-[10px] border transition-all duration-150 ease-out",
                            cell ? "" : "",
                            !cell
                              ? "bg-gradient-to-br from-[#1c1c1c] to-[#0e0e0e] border-[#2e2818]/95 shadow-[inset_0_3px_10px_rgba(0,0,0,0.55)]"
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
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border border-[#8a7328]/45 bg-[#0a0a09]/95 p-4 sm:p-5 shadow-[0_16px_48px_rgba(0,0,0,0.4),0_0_40px_rgba(212,175,55,0.04)]"
          style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,215,0,0.05)" }}
        >
          <h2 className="text-sm font-semibold text-[#f0d060] tracking-wide mb-4">Peças</h2>
          <div className="flex flex-wrap gap-4 justify-center items-end">
            {hand.map((piece, slot) => {
              if (!piece) {
                return (
                  <div
                    key={`empty_${slot}`}
                    className="w-[108px] h-[108px] rounded-xl border border-dashed border-[#4a4020]/65 bg-[#080807]/90 flex items-center justify-center text-white/18 text-xs tracking-wide"
                  >
                    vazio
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
                    "p-3 rounded-xl border transition-all duration-200 flex items-center justify-center min-h-[108px] min-w-[108px] touch-none cursor-grab active:cursor-grabbing select-none",
                    draggingThis
                      ? "opacity-35 border-[#5c4d22]/35 scale-[0.98]"
                      : "border-[#8a7328]/45 bg-gradient-to-b from-[#15130e] to-[#080807] shadow-[0_0_24px_rgba(212,175,55,0.06),inset_0_1px_0_rgba(255,215,0,0.06)] hover:border-[#c9a227]/55",
                  ].join(" ")}
                  style={{ touchAction: "none" }}
                >
                  <ShapePreview cells={piece.cells} hue={piece.hue} cellPx={22} gapPx={3} dimmed={draggingThis} />
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs sm:text-sm text-white/45 leading-relaxed break-words">
            Arraste pelos blocos dourados até o quadro. Verde no preview = encaixa ao soltar. Linhas e colunas cheias
            somem.
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
