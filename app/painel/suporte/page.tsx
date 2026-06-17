"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarbershopFeedbackSection } from "@/components/support/barbershop-feedback-section"
import { Lightbulb, MessageCircle } from "lucide-react"

type Msg = {
  id: string
  body: string
  sender: string
  created_at: string
}

function SupportChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch("/api/support/messages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMessages)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      const r = await fetch("/api/support/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      })
      if (r.ok) {
        setText("")
        load()
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="bg-card border-border w-full min-h-[calc(100dvh-13rem)] flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-lg">Conversa com a equipe</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex-1 min-h-[320px] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma mensagem ainda. Dúvidas urgentes ou problemas no dia a dia? Escreva abaixo.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
                  m.sender === "barbearia"
                    ? "ml-auto bg-primary/15 text-foreground border border-primary/25"
                    : "mr-auto bg-secondary text-foreground border border-border"
                }`}
              >
                <p className="text-[10px] uppercase text-muted-foreground mb-1">
                  {m.sender === "barbearia" ? "Você" : "Trim Time"}
                </p>
                {m.body}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t border-border shrink-0">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem…"
            className="bg-background"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())}
          />
          <Button
            type="button"
            className="bg-primary text-primary-foreground shrink-0"
            disabled={sending}
            onClick={() => void send()}
          >
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function PainelSuportePage() {
  return (
    <div className="space-y-6 w-full min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-7 h-7 text-primary" />
          Suporte Trim Time
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Chat com a equipe ou envie sugestões estruturadas para melhorar o aplicativo.
        </p>
      </div>

      <Tabs defaultValue="chat" className="space-y-4 w-full">
        <TabsList className="bg-secondary/50 border border-border w-full max-w-xl grid grid-cols-2 h-auto p-1">
          <TabsTrigger value="chat" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MessageCircle className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Lightbulb className="w-4 h-4" />
            Sugestões e melhorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <SupportChatPanel />
        </TabsContent>

        <TabsContent value="feedback">
          <BarbershopFeedbackSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
