"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { fetchTrimPlayRanking } from "./trimplayApi"
import { loadCachedRanking, saveCachedRanking } from "./trimplayStorage"

type RankRow = { rank: number; cliente_id: string; cliente_nome: string; score: number }

function medalEmoji(rank: number): string | null {
  if (rank === 1) return "🥇"
  if (rank === 2) return "🥈"
  if (rank === 3) return "🥉"
  return null
}

function rowToneClasses(rank: number, isMe: boolean, fs: boolean): string {
  const base = fs
    ? "rounded-xl border py-3 px-3 sm:py-4 sm:px-4 transition-colors"
    : "rounded-none border-b border-white/5 last:border-0 py-2.5"
  if (isMe) {
    return `${base} ${fs ? "border-[#c9a227]/90 bg-[#2a2418]/50 ring-1 ring-[#d4af37]/35" : "bg-[#1f1a0d]/80"}`
  }
  if (rank === 1) {
    return `${base} ${fs ? "border-amber-400/55 bg-gradient-to-r from-amber-500/18 via-amber-950/25 to-[#0c0c0a]/90 shadow-[0_0_28px_rgba(245,158,11,0.12)]" : "border-amber-500/30 bg-amber-950/15"}`
  }
  if (rank === 2) {
    return `${base} ${fs ? "border-slate-300/45 bg-gradient-to-r from-slate-400/14 via-slate-900/30 to-[#0c0c0a]/90" : "border-slate-400/25 bg-slate-900/20"}`
  }
  if (rank === 3) {
    return `${base} ${fs ? "border-orange-600/50 bg-gradient-to-r from-orange-700/16 via-orange-950/35 to-[#0c0c0a]/90" : "border-orange-700/30 bg-orange-950/15"}`
  }
  return `${base} ${fs ? "border-[#3d3520]/80 bg-[#0c0c0a]/90 hover:border-[#6b5a28]/50" : ""}`
}

function rankBadgeClasses(rank: number, fs: boolean): string {
  const sz = fs ? "w-11 h-11 sm:w-12 sm:h-12 text-base sm:text-lg" : "w-9 h-9 text-sm"
  const common = `shrink-0 rounded-xl flex flex-col items-center justify-center font-bold tabular-nums leading-none border`
  if (rank === 1) {
    return `${common} ${sz} border-amber-400/60 bg-gradient-to-b from-amber-200/25 to-amber-900/40 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.2)]`
  }
  if (rank === 2) {
    return `${common} ${sz} border-slate-300/55 bg-gradient-to-b from-slate-200/20 to-slate-800/50 text-slate-100`
  }
  if (rank === 3) {
    return `${common} ${sz} border-orange-600/55 bg-gradient-to-b from-orange-300/15 to-orange-950/45 text-orange-100`
  }
  return `${common} ${sz} border-[#5c4d22]/55 bg-black/50 text-[#d4af37]/90`
}

type Props = {
  barbershopId: string
  clienteId?: string
  className?: string
  header?: ReactNode
  /** `fullscreen` = lista ampla para overlay em tela cheia */
  variant?: "card" | "fullscreen"
}

export function TrimPlayRankingPanel({
  barbershopId,
  clienteId,
  className,
  header,
  variant = "card",
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ranking, setRanking] = useState<{
    top: RankRow[]
    my: null | { cliente_id: string; score: number; rank: number }
  } | null>(null)

  const fs = variant === "fullscreen"

  useEffect(() => {
    const cached = loadCachedRanking(barbershopId)
    if (cached) {
      setRanking({ top: cached.top, my: cached.my })
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbershopId])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!navigator.onLine) return
      setError(null)
      setLoading(true)
      try {
        const data = await fetchTrimPlayRanking({ barbershopId, clienteId })
        if (cancelled) return
        setRanking(data)
        saveCachedRanking(barbershopId, { top: data.top, my: data.my })
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Erro ao buscar ranking")
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [barbershopId, clienteId])

  const rootClass = fs
    ? [
        "flex flex-col min-h-0 flex-1 w-full max-w-md mx-auto rounded-2xl border border-[#b8860b]/35 bg-gradient-to-b from-[#10100e] to-[#060605] overflow-hidden shadow-[0_0_48px_rgba(212,175,55,0.12),inset_0_1px_0_rgba(255,215,0,0.06)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")
    : [className ?? "rounded-xl border border-[#c9a227]/30 bg-black text-white"].filter(Boolean).join(" ")

  return (
    <div className={rootClass}>
      <div
        className={
          fs
            ? "px-5 py-5 border-b border-[#5c4d22]/50 bg-black/25 shrink-0"
            : "px-4 py-3 border-b border-[#5c4d22]/55 bg-black/30"
        }
      >
        <div className={fs ? "text-lg" : ""}>{header}</div>
        {clienteId && ranking?.my ? (
          <div className={`text-white/70 mt-2 ${fs ? "text-base" : "text-sm"}`}>
            Você: <span className="text-[#fcdf7b] font-semibold tabular-nums">#{ranking.my.rank}</span>
            <span className="text-white/45 mx-2">·</span>
            <span className="text-[#e8c547] font-medium tabular-nums">{ranking.my.score} pts</span>
            <span className="text-white/35 text-xs block sm:inline sm:ml-2">
              (veja sua linha destacada na lista)
            </span>
          </div>
        ) : null}
      </div>

      <div className={`text-white/90 min-h-0 flex flex-col flex-1 ${fs ? "p-4 sm:p-5 overflow-y-auto" : "p-4"}`}>
        {loading ? (
          <div className={`text-white/45 ${fs ? "text-base py-12 text-center" : "text-sm"}`}>Carregando ranking…</div>
        ) : null}
        {error ? <div className="text-red-300 text-sm mb-3">{error}</div> : null}
        {!ranking && !loading ? (
          <div className={`text-white/45 ${fs ? "text-base py-12 text-center" : "text-sm"}`}>Sem dados ainda.</div>
        ) : null}

        {ranking ? (
          <ol className={fs ? "space-y-1.5 sm:space-y-2 flex-1 min-h-0" : "space-y-0 max-h-64 overflow-y-auto"}>
            {ranking.top.length === 0 ? (
              <li
                className={`text-white/40 text-center ${fs ? "text-base py-16 px-4 leading-relaxed" : "text-sm"}`}
              >
                Sem placares nesta barbearia.
                <br />
                <span className="text-white/25 text-sm mt-2 inline-block">Jogue e seja o primeiro!</span>
              </li>
            ) : (
              ranking.top.map((row) => {
                const isMe = !!clienteId && row.cliente_id === clienteId
                const medal = medalEmoji(row.rank)
                return (
                  <li
                    key={`${row.cliente_id}_${row.rank}`}
                    className={[
                      "flex items-center justify-between gap-2 sm:gap-3",
                      rowToneClasses(row.rank, isMe, fs),
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span
                        className={rankBadgeClasses(row.rank, fs)}
                        aria-label={`Posição ${row.rank}`}
                      >
                        {medal ? (
                          <span className="text-lg sm:text-xl leading-none" aria-hidden>
                            {medal}
                          </span>
                        ) : null}
                        <span className={medal ? "text-[10px] sm:text-xs opacity-90 font-semibold" : ""}>
                          {row.rank}
                        </span>
                      </span>
                      <span
                        className={`text-white truncate ${fs ? "font-medium text-base" : "text-sm"} ${
                          isMe ? "text-[#ffeb9c]" : ""
                        }`}
                      >
                        {row.cliente_nome?.trim() || "Jogador"}
                        {isMe ? (
                          <span className="ml-1.5 text-[#c9a227] text-xs font-normal whitespace-nowrap">(você)</span>
                        ) : null}
                      </span>
                    </div>
                    <span className={`text-[#f0d060] font-semibold tabular-nums shrink-0 ${fs ? "text-base sm:text-lg" : "text-sm"}`}>
                      {row.score}
                    </span>
                  </li>
                )
              })
            )}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
