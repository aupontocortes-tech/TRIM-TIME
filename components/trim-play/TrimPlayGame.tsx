"use client"

import { useEffect, useMemo, useState } from "react"
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

const SIZE = 8
const HAND_SIZE = 3

type Piece = { id: string; value: number }
type Cell = { value: number; pieceId: string } | null

function emptyBoard(): Cell[][] {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null)
  )
}

function randomPiece(): Piece {
  const value = 1 + Math.floor(Math.random() * 3) // 1..3
  return { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, value }
}

function hasEmptyCells(board: Cell[][]) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!board[r][c]) return true
    }
  }
  return false
}

function computeClears(board: Cell[][]) {
  const clearCoords = new Set<string>()
  const clearValues: number[] = []

  // Full rows
  for (let r = 0; r < SIZE; r++) {
    const full = board[r].every((cell) => cell !== null)
    if (!full) continue
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c]
      if (!cell) continue
      const key = `${r},${c}`
      if (!clearCoords.has(key)) {
        clearCoords.add(key)
        clearValues.push(cell.value)
      }
    }
  }

  // Full cols
  for (let c = 0; c < SIZE; c++) {
    let full = true
    for (let r = 0; r < SIZE; r++) {
      if (!board[r][c]) {
        full = false
        break
      }
    }
    if (!full) continue
    for (let r = 0; r < SIZE; r++) {
      const cell = board[r][c]
      if (!cell) continue
      const key = `${r},${c}`
      if (!clearCoords.has(key)) {
        clearCoords.add(key)
        clearValues.push(cell.value)
      }
    }
  }

  const clearedCount = clearCoords.size
  const sumValues = clearValues.reduce((a, b) => a + b, 0)

  return {
    clearedCount,
    sumValues,
    clearCoords: Array.from(clearCoords).map((s) => {
      const [rs, cs] = s.split(",")
      return { r: Number(rs), c: Number(cs) }
    }),
  }
}

function applyClears(board: Cell[][], coords: { r: number; c: number }[]) {
  const next = board.map((row) => row.slice())
  for (const { r, c } of coords) {
    next[r][c] = null
  }
  return next
}

function generateHand(): Piece[] {
  return Array.from({ length: HAND_SIZE }, () => randomPiece())
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
  const [board, setBoard] = useState<Cell[][]>(() => emptyBoard())
  const [hand, setHand] = useState<Piece[]>(() => generateHand())
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [state, setState] = useState<"playing" | "over">("playing")
  const [activePieceId, setActivePieceId] = useState<string | null>(null)

  const [bestLocal, setBestLocal] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)

  const canPlay = state === "playing"

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

  const placePiece = async (r: number, c: number) => {
    if (!canPlay) return
    if (board[r][c]) return
    if (!activePieceId) return

    const piece = hand.find((p) => p.id === activePieceId)
    if (!piece) return

    // Apply placement
    const next = board.map((row) => row.slice())
    next[r][c] = { value: piece.value, pieceId: piece.id }
    const nextHand = hand.filter((p) => p.id !== piece.id)

    setBoard(next)
    setHand(nextHand)
    setActivePieceId(null)

    // Round finished (placed all 3 pieces)
    if (nextHand.length > 0) return

    const { clearedCount, sumValues, clearCoords } = computeClears(next)
    const points = clearedCount > 0 ? clearedCount * 10 + sumValues * 5 : 0
    const afterClear = clearCoords.length ? applyClears(next, clearCoords) : next

    const nextScore = score + points
    setScore(nextScore)
    setRound((v) => v + 1)

    // Game over if no empty cells left
    if (!hasEmptyCells(afterClear)) {
      setBoard(afterClear)
      setState("over")
      // Save best locally & queue sync
      if (nextScore > bestLocal) {
        setBestLocal(nextScore)
        saveBestLocal(barbershopId, clienteId, nextScore)
        if (navigator.onLine) {
          try {
            await submitTrimPlayScore({
              barbershopId,
              clienteId,
              clienteName: clienteNome,
              score: nextScore,
            })
            clearPendingScore(barbershopId, clienteId)
            const ranking = await fetchTrimPlayRanking({ barbershopId, clienteId })
            saveCachedRanking(barbershopId, { top: ranking.top, my: ranking.my })
            setSyncError(null)
          } catch (e) {
            savePendingScore(barbershopId, clienteId, nextScore)
            setSyncError(e instanceof Error ? e.message : "Sem conexão para sincronizar")
          }
        } else {
          savePendingScore(barbershopId, clienteId, nextScore)
          setSyncError("Sem internet: pontuação será enviada quando voltar.")
        }
      }
      return
    }

    // Next round
    setBoard(afterClear)
    setHand(generateHand())
  }

  const reset = () => {
    setBoard(emptyBoard())
    setHand(generateHand())
    setScore(0)
    setRound(1)
    setState("playing")
    setActivePieceId(null)
    setSyncError(null)
  }

  const onCellClick = (r: number, c: number) => void placePiece(r, c)

  const boardCells = useMemo(() => board, [board])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="sticky top-0 z-10 border-b border-[#FFD700]/20 bg-black/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl border border-[#FFD700]/35 flex items-center justify-center">
              <span className="text-[#FFD700] font-black">♛</span>
            </div>
            <div>
              <div className="text-sm text-white/80">Trim Play</div>
              <div className="text-base font-semibold text-[#FFD700]">
                {state === "over" ? "Game Over" : `Rodada ${round}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-white/80">
              Pontos: <span className="text-[#FFD700] font-semibold">{score}</span>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="px-3 py-2 rounded-lg border border-[#FFD700]/35 text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>

      {syncError ? (
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="text-sm text-red-200 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">
            {syncError}
          </div>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto w-full px-4 py-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="text-sm text-white/70">
              Melhor local:{" "}
              <span className="text-[#FFD700] font-semibold">{bestLocal}</span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-sm px-3 py-2 rounded-lg border border-[#FFD700]/35 text-[#FFD700] hover:bg-[#FFD700]/10 transition-colors"
            >
              {state === "over" ? "Jogar de novo" : "Reiniciar"}
            </button>
          </div>

          <div
            className="touch-none select-none"
            style={{ borderColor: "#FFD70033", background: "#000" }}
          >
            <div className="grid grid-cols-8 gap-1 p-2 rounded-xl border border-[#FFD700]/25">
              {boardCells.map((row, r) =>
                row.map((cell, c) => {
                  const isActive = false
                  return (
                    <div
                      key={`${r}_${c}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Celula ${r},${c}`}
                      onClick={() => onCellClick(r, c)}
                      onPointerUp={() => onCellClick(r, c)}
                      className={[
                        "aspect-square rounded-md border transition-colors",
                        cell
                          ? "bg-[#FFD700]/15 border-[#FFD700]/30"
                          : "bg-[#0a0a0a] border-[#FFD700]/10 hover:bg-[#FFD700]/5",
                        activePieceId && !cell ? "ring-1 ring-[#FFD700]/30" : "",
                        isActive ? "bg-[#FFD700]/30" : "",
                      ].join(" ")}
                    >
                      {cell ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div
                            className="w-5 h-5 rounded bg-[#FFD700] flex items-center justify-center"
                            style={{ boxShadow: "0 0 16px rgba(255,215,0,0.35)" }}
                          >
                            <span className="text-black text-[11px] font-bold">
                              {cell.value}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl border border-[#FFD700]/25 bg-[#050505]">
            <div className="text-sm font-semibold text-[#FFD700] mb-2">Peças da rodada</div>
            <div className="flex gap-2 flex-wrap">
              {hand.map((p) => {
                const active = activePieceId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePieceId(p.id)}
                    onPointerDown={() => setActivePieceId(p.id)}
                    className={[
                      "w-14 h-14 rounded-xl border flex items-center justify-center transition-colors",
                      active ? "border-[#FFD700] bg-[#FFD700]/15" : "border-[#FFD700]/25 bg-[#0a0a0a]",
                    ].join(" ")}
                    style={{ touchAction: "none" }}
                    aria-label={`Selecionar peça ${p.value}`}
                  >
                    <span className="text-[#FFD700] text-2xl font-black">{p.value}</span>
                  </button>
                )
              })}

              {hand.length === 0 ? (
                <div className="text-white/60 text-sm py-2">Resolvendo rodada…</div>
              ) : null}
            </div>
            <div className="mt-2 text-xs text-white/60">
              Toque/arraste a peça para colocar no tabuleiro. Quando acabar as 3 peças, a rodada é resolvida.
            </div>
          </div>
        </div>

        <div className="w-full md:w-[360px]">
          <TrimPlayRankingPanel barbershopId={barbershopId} clienteId={clienteId} />
        </div>
      </div>

      {state === "over" ? (
        <div className="fixed inset-0 z-[2147483646] bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#FFD700]/35 bg-black">
            <div className="p-6">
              <div className="text-[#FFD700] font-black text-2xl mb-2">Game Over</div>
              <div className="text-white/80 text-sm">
                Sua pontuação: <span className="font-bold text-[#FFD700]">{score}</span>
              </div>
              <div className="mt-4 text-white/70 text-sm">
                {syncError ? syncError : "Salvando e atualizando o ranking…"}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#FFD700] text-black font-semibold hover:opacity-95"
                >
                  Jogar de novo
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="px-3 py-2 rounded-lg border border-[#FFD700]/35 text-[#FFD700] hover:bg-[#FFD700]/10"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

