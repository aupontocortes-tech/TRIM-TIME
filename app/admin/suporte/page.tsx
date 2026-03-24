"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { MessageCircle } from "lucide-react"

type Thread = {
  barbershop_id: string
  name: string
  slug: string
  unread_from_barbershop: number
  last_message: { body: string; sender: string; created_at: string } | null
}

export default function AdminSuporteListPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/support/threads")
      .then((r) => (r.ok ? r.json() : []))
      .then(setThreads)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Suporte</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Conversas com barbearias — responda por barbearia
        </p>
      </div>

      <Card className="bg-zinc-950 border-[#D4AF37]/35">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-zinc-500">Carregando…</p>
          ) : threads.length === 0 ? (
            <p className="p-6 text-zinc-500">Nenhuma barbearia.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {threads.map((t) => (
                <li key={t.barbershop_id}>
                  <Link
                    href={`/admin/suporte/${t.barbershop_id}`}
                    className="flex items-start gap-3 p-4 hover:bg-zinc-900/80 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{t.name}</span>
                        {t.unread_from_barbershop > 0 ? (
                          <span className="text-xs bg-[#D4AF37] text-black px-2 py-0.5 rounded-full font-semibold">
                            {t.unread_from_barbershop} nova(s)
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-zinc-500 truncate mt-0.5">
                        {t.last_message
                          ? `${t.last_message.sender === "admin" ? "Você" : "Barbearia"}: ${t.last_message.body}`
                          : "Sem mensagens ainda"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
