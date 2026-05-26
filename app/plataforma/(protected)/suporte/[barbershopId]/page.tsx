"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

type Msg = {
  id: string
  body: string
  sender: string
  created_at: string
}

export default function PlataformaSuporteChatPage() {
  const params = useParams()
  const router = useRouter()
  const barbershopId = (params?.barbershopId as string) || ""
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    if (!barbershopId) return
    setError("")
    fetch(`/api/admin/support/${barbershopId}/messages`)
      .then(async (r) => {
        if (r.ok) return r.json()
        const data = await r.json().catch(() => ({}))
        setError(typeof data.error === "string" ? data.error : "Não foi possível carregar as mensagens.")
        return []
      })
      .then(setMessages)
      .finally(() => setLoading(false))
  }, [barbershopId])

  useEffect(() => {
    load()
  }, [load])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      const r = await fetch(`/api/admin/support/${barbershopId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      })
      if (r.ok) {
        setText("")
        load()
      } else {
        const data = await r.json().catch(() => ({}))
        setError(typeof data.error === "string" ? data.error : "Não foi possível enviar a mensagem.")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-[#D4AF37]"
          onClick={() => router.push("/plataforma/suporte")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
      </div>
      <h1 className="text-xl font-bold text-white">Conversa</h1>
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}

      <Card className="bg-zinc-950 border-[#D4AF37]/35 min-h-[320px] flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col gap-3">
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[50vh]">
            {loading ? (
              <p className="text-zinc-500">Carregando…</p>
            ) : messages.length === 0 ? (
              <p className="text-zinc-500">Nenhuma mensagem. Envie a primeira.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                    m.sender === "admin"
                      ? "ml-auto bg-[#D4AF37]/20 text-white border border-[#D4AF37]/30"
                      : "mr-auto bg-zinc-900 text-zinc-200 border border-zinc-700"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                    {m.sender === "admin" ? "Admin" : "Barbearia"}
                  </p>
                  {m.body}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-zinc-800">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Sua mensagem…"
              className="bg-zinc-900 border-zinc-700 text-white"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())}
            />
            <Button
              type="button"
              className="bg-[#D4AF37] text-black hover:bg-[#c9a227] shrink-0"
              disabled={sending}
              onClick={() => void send()}
            >
              Enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
