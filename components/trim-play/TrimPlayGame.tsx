"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
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
  setTrimPlayMuted,
  unlockTrimPlayAudio,
} from "./trimPlayHowler"

const SIZE = 8

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
  const [myRanking, setMyRanking] = useState<null | { rank: number; score: number }>(null)

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

  useEffect(() => {
    let cancelled = false
    async function loadMyRanking() {
      try {
        if (!navigator.onLine) return
        const ranking = await fetchTrimPlayRanking({ barbershopId, clienteId })
        if (cancelled) return
        saveCachedRanking(barbershopId, { top: ranking.top, my: ranking.my })
        setMyRanking(ranking.my ? { rank: ranking.my.rank, score: ranking.my.score } : null)
      } catch {
        // Sem bloquear o jogo caso o ranking esteja indisponível.
      }
    }
    void loadMyRanking()
    return () => {
      cancelled = true
    }
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
      setMyRanking(ranking.my ? { rank: ranking.my.rank, score: ranking.my.score } : null)
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
      }
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
          setMyRanking(ranking.my ? { rank: ranking.my.rank, score: ranking.my.score } : null)
          setSyncError(null)
        } catch (e) {
          savePendingScore(barbershopId, clienteId, finalScore)
          setSyncError(e instanceof Error ? e.message : "Sem conexão para sincronizar")
        }
      } else {
        savePendingScore(barbershopId, clienteId, finalScore)
        setSyncError("Sem internet: pontuação será enviada quando voltar.")
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
          <p className="text-[12px] sm:text-sm text-white/75 tabular-nums leading-tight truncate mt-0.5">
            <span className="inline-flex items-center gap-1 text-[#f0d060] font-semibold">
              <Trophy className="h-3 w-3" />
              <span>#{myRanking?.rank ?? "--"}</span>
            </span>
            <span className="text-white/40"> · </span>
            <span>{bestLocal} melhor</span>
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

      <main className="relative z-0 flex-1 min-h-0 flex flex-col w-full max-w-lg mx-auto touch-pan-y">
        <div className="shrink-0 flex justify-center pt-2 sm:pt-3 pb-2 sm:pb-3">
          <span className="text-5xl sm:text-6xl leading-none font-semibold tracking-tight text-white/90 tabular-nums">
            {score}
          </span>
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
                ref={boardGridRef}
                className="grid touch-none h-full w-full gap-0.5 sm:gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
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
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0" />

        {/* Três peças sempre na mesma linha; altura fixa enxuta */}
        <section className="shrink-0 border-t border-[#3d3520]/50 bg-[#060605]/90 px-1.5 sm:px-3 pt-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
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
