"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FEEDBACK_AREAS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_IMPACTS,
  type ProductFeedbackDto,
  feedbackAreaLabel,
  feedbackCategoryLabel,
  feedbackImpactLabel,
} from "@/lib/product-feedback"
import { FeedbackStatusBadge } from "@/components/support/feedback-status-badge"
import { Lightbulb, Loader2, Send, Sparkles } from "lucide-react"

export function BarbershopFeedbackSection() {
  const [items, setItems] = useState<ProductFeedbackDto[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [category, setCategory] = useState("improvement")
  const [area, setArea] = useState("geral")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [impact, setImpact] = useState("medium")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/support/feedback", { credentials: "include" })
      const j = await r.json().catch(() => [])
      if (r.ok) setItems(Array.isArray(j) ? j : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setErr(null)
    setOk(null)
    try {
      const r = await fetch("/api/support/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, area, title, description, impact }),
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setErr(j.error || "Não foi possível enviar")
        return
      }
      setOk("Obrigado! Sua sugestão foi registrada e será analisada pela equipe Trim Time.")
      setTitle("")
      setDescription("")
      await load()
    } catch {
      setErr("Erro de rede")
    } finally {
      setSending(false)
    }
  }

  const selectedCategory = FEEDBACK_CATEGORIES.find((c) => c.id === category)

  return (
    <div className="space-y-6 w-full min-w-0">
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 overflow-hidden w-full">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-foreground text-lg">Central de melhorias</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 leading-relaxed">
                Ajude a evoluir o Trim Time. Conte o que podemos implementar, melhorar ou corrigir —
                sua opinião entra no nosso roadmap de produto.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start w-full">
      <Card className="bg-card border-border w-full lg:min-h-[calc(100dvh-16rem)]">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2 text-base">
            <Lightbulb className="w-5 h-5 text-primary" />
            Enviar sugestão
          </CardTitle>
          <CardDescription>
            Seja específico: o que você espera, em qual tela e como isso ajuda sua barbearia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {err ? (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
              {err}
            </p>
          ) : null}
          {ok ? (
            <p className="text-sm text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/25 rounded-md p-3 mb-4">
              {ok}
            </p>
          ) : null}

          <form onSubmit={submit} className="space-y-5 w-full">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fb-category">Tipo de feedback</Label>
                <select
                  id="fb-category"
                  className="mt-1.5 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {FEEDBACK_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {selectedCategory ? (
                  <p className="text-xs text-muted-foreground mt-1.5">{selectedCategory.description}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="fb-area">Área do app</Label>
                <select
                  id="fb-area"
                  className="mt-1.5 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  {FEEDBACK_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="fb-title">Título resumido</Label>
              <Input
                id="fb-title"
                className="mt-1.5"
                placeholder="Ex.: Exportar relatório financeiro em PDF"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <div>
              <Label htmlFor="fb-desc">Descrição detalhada</Label>
              <Textarea
                id="fb-desc"
                className="mt-1.5 min-h-[160px] lg:min-h-[200px]"
                placeholder="Explique o contexto, o que acontece hoje e o resultado ideal. Quanto mais claro, mais rápido analisamos."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="fb-impact">Impacto para sua operação</Label>
              <select
                id="fb-impact"
                className="mt-1.5 w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
              >
                {FEEDBACK_IMPACTS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={sending} className="bg-primary text-primary-foreground">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar para análise
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border w-full lg:min-h-[calc(100dvh-16rem)] flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="text-foreground text-base">Suas sugestões enviadas</CardTitle>
          <CardDescription>Acompanhe o status de cada ideia no roadmap.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100dvh-20rem)] lg:max-h-none">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma sugestão ainda. Seu primeiro feedback ajuda a priorizar o que vem a seguir.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {feedbackCategoryLabel(item.category)}
                        {item.area ? ` · ${feedbackAreaLabel(item.area)}` : ""}
                        {" · "}
                        {feedbackImpactLabel(item.impact)}
                      </p>
                    </div>
                    <FeedbackStatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Enviado em{" "}
                    {new Date(item.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
