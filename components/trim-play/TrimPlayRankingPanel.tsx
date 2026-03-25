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
}

export function TrimPlayRankingPanel({
  barbershopId,
  clienteId,
  className,
  header,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ranking, setRanking] = useState<{
    top: { rank: number; cliente_id: string; cliente_nome: string; score: number }[]
    my: null | { cliente_id: string; score: number; rank: number }
  } | null>(null)

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

  return (
    <div
      className={className ?? ""}
      style={{ borderColor: "#FFD70033", background: "#000" }}
    >
      <div className="px-4 py-3 border-b border-[#FFD700]/20">
        {header ?? (
          <div className="flex items-center gap-2">
            <span className="text-[#FFD700] font-semibold">🏆 Ranking</span>
          </div>
        )}
        {clienteId && ranking?.my?.rank ? (
          <div className="text-sm text-white/80 mt-1">
            Você está em <span className="text-[#FFD700] font-semibold">#{ranking.my.rank}</span>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        {loading ? <div className="text-white/60">Carregando…</div> : null}
        {error ? <div className="text-red-300 text-sm mb-3">{error}</div> : null}
        {!ranking && !loading ? (
          <div className="text-white/60 text-sm">Sem dados ainda.</div>
        ) : null}

        {ranking ? (
          <ol className="space-y-2">
            {ranking.top.length === 0 ? (
              <li className="text-white/60 text-sm">Sem placares.</li>
            ) : (
              ranking.top.map((row) => (
                <li
                  key={row.cliente_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 text-right text-[#FFD700] font-semibold">
                      #{row.rank}
                    </span>
                    <span className="text-white truncate">{row.cliente_nome}</span>
                  </div>
                  <span className="text-white font-semibold">{row.score} pts</span>
                </li>
              ))
            )}
          </ol>
        ) : null}
      </div>
    </div>
  )
}

