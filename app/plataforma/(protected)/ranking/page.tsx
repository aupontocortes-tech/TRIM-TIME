"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"

type Row = {
  barbershop_id: string
  name: string
  slug: string
  active: boolean
  appointments: number
}

export default function PlataformaRankingPage() {
  const [allTime, setAllTime] = useState<Row[]>([])
  const [last30, setLast30] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/ranking")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setAllTime(d.byAppointmentsAllTime ?? [])
          setLast30(d.byAppointmentsLast30Days ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const Table = ({ title, rows }: { title: string; rows: Row[] }) => (
    <Card className="bg-zinc-950 border-[#D4AF37]/35 text-white">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Trophy className="w-5 h-5 text-[#D4AF37]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-zinc-500">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-zinc-500">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D4AF37]/25 text-left text-zinc-400">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">Barbearia</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 text-right">Agendamentos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.barbershop_id} className="border-b border-zinc-800/80">
                    <td className="py-2 pr-2 text-zinc-500">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium">{r.name}</td>
                    <td className="py-2 pr-2">
                      {r.active ? (
                        <span className="text-emerald-400">Ativa</span>
                      ) : (
                        <span className="text-red-400">Suspensa</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#D4AF37]">
                      {r.appointments}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ranking</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Barbearias com mais agendamentos (geral e últimos 30 dias)
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Table title="Todos os tempos" rows={allTime} />
        <Table title="Últimos 30 dias" rows={last30} />
      </div>
    </div>
  )
}
