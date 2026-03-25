"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { fetchTrimPlayRanking } from "./trimplayApi"
import { loadCachedRanking, saveCachedRanking } from "./trimplayStorage"

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
    top: { rank: number; cliente_id: string; cliente_nome: string; score: number }[]
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
        {clienteId && ranking?.my?.rank ? (
          <div className={`text-white/70 mt-2 ${fs ? "text-base" : "text-sm"}`}>
            Sua posição: <span className="text-[#f0d060] font-semibold tabular-nums">#{ranking.my.rank}</span>
            <span className="text-white/45 mx-2">·</span>
            <span className="text-[#e8c547] font-medium tabular-nums">{ranking.my.score} pts</span>
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
          <ol className={fs ? "space-y-2 flex-1" : "space-y-2.5"}>
            {ranking.top.length === 0 ? (
              <li
                className={`text-white/40 text-center ${fs ? "text-base py-16 px-4 leading-relaxed" : "text-sm"}`}
              >
                Sem placares nesta barbearia.
                <br />
                <span className="text-white/25 text-sm mt-2 inline-block">Jogue e seja o primeiro!</span>
              </li>
            ) : (
              ranking.top.map((row, i) => (
                <li
                  key={row.cliente_id}
                  className={[
                    "flex items-center justify-between gap-3 rounded-xl border transition-colors",
                    fs
                      ? "text-base py-4 px-4 border-[#3d3520]/80 bg-[#0c0c0a]/90 hover:border-[#6b5a28]/50"
                      : "text-sm py-1 border-b border-white/5 last:border-0 rounded-none bg-transparent",
                    i === 0 && fs ? "border-[#c9a227]/40 bg-[#1a1608]/80 shadow-[0_0_24px_rgba(212,175,55,0.08)]" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={[
                        "shrink-0 font-bold tabular-nums text-[#d4af37]",
                        fs ? "w-10 h-10 rounded-lg bg-black/40 border border-[#5c4d22]/50 flex items-center justify-center text-lg" : "w-7 text-right text-sm",
                      ].join(" ")}
                    >
                      {row.rank}
                    </span>
                    <span className={`text-white/90 truncate ${fs ? "font-medium" : ""}`}>{row.cliente_nome}</span>
                  </div>
                  <span className={`text-[#f0d060] font-semibold tabular-nums shrink-0 ${fs ? "text-lg" : ""}`}>
                    {row.score}
                  </span>
                </li>
              ))
            )}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
