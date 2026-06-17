"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductFeedbackBoard } from "@/components/admin/product-feedback-board"
import { Lightbulb, MessageCircle } from "lucide-react"

type Thread = {
  barbershop_id: string
  name: string
  slug: string
  unread_from_barbershop: number
  last_message: { body: string; sender: string; created_at: string } | null
}

function SupportThreadsList() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/support/threads")
      .then((r) => (r.ok ? r.json() : []))
      .then(setThreads)
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="bg-zinc-950 border-[#D4AF37]/35 w-full min-h-[calc(100dvh-13rem)]">
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
                  href={`/plataforma/suporte/${t.barbershop_id}`}
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
  )
}

export default function PlataformaSuporteListPage() {
  return (
    <div className="space-y-6 w-full min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-white">Suporte</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Conversas com barbearias e central de feedback de produto — o que implementar e melhorar.
        </p>
      </div>

      <Tabs defaultValue="chat" className="space-y-4 w-full">
        <TabsList className="bg-zinc-950 border border-[#D4AF37]/30 w-full max-w-xl grid grid-cols-2 h-auto p-1">
          <TabsTrigger
            value="chat"
            className="gap-2 py-2.5 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-zinc-400"
          >
            <MessageCircle className="w-4 h-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger
            value="feedback"
            className="gap-2 py-2.5 data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-zinc-400"
          >
            <Lightbulb className="w-4 h-4" />
            Feedback & roadmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <SupportThreadsList />
        </TabsContent>

        <TabsContent value="feedback">
          <ProductFeedbackBoard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
