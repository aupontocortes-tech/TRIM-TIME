"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { TRIMPLAY_AUDIO_BUCKET, TRIMPLAY_AUDIO_MAX_BYTES } from "@/lib/trimplay-audio-constants"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Music, Upload, Save, Play, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react"

type AudioAsset = {
  id: string
  category: string
  file_url: string
  file_name: string
  trim_start_sec: number
  trim_end_sec: number
  volume: number
  enabled: boolean
  sort_order: number
}

type VisualEffectAsset = {
  id: string
  event_key: "combo1" | "combo2" | "combo3" | "combo4" | "combo5" | "victory" | "gameover"
  effect_key:
    | "efeito_texto"
    | "efeito_brilho"
    | "efeito_tremer"
    | "efeito_flash"
    | "efeito_particulas"
    | "efeito_explosao"
    | "efeito_raio"
    | "efeito_escurecer"
  enabled: boolean
  sort_order: number
}

const ORDER = ["combo1", "combo2", "combo3", "combo4", "combo5", "gameover", "victory"] as const
const LABELS: Record<(typeof ORDER)[number], string> = {
  combo1: "COMBO_1",
  combo2: "COMBO_2",
  combo3: "COMBO_3",
  combo4: "COMBO_4",
  combo5: "COMBO_5",
  gameover: "GAME_OVER",
  victory: "VITORIA",
}

const VISUAL_EVENTS: VisualEffectAsset["event_key"][] = [
  "combo1",
  "combo2",
  "combo3",
  "combo4",
  "combo5",
  "victory",
  "gameover",
]
const VISUAL_EVENT_LABELS: Record<VisualEffectAsset["event_key"], string> = {
  combo1: "COMBO_1",
  combo2: "COMBO_2",
  combo3: "COMBO_3",
  combo4: "COMBO_4",
  combo5: "COMBO_5",
  victory: "VITORIA",
  gameover: "GAME_OVER",
}

const VISUAL_EFFECT_LABELS: Record<VisualEffectAsset["effect_key"], string> = {
  efeito_texto: "Efeito Texto",
  efeito_brilho: "Efeito Brilho",
  efeito_tremer: "Efeito Tremer",
  efeito_flash: "Efeito Flash",
  efeito_particulas: "Efeito Partículas",
  efeito_explosao: "Efeito Explosão",
  efeito_raio: "Efeito Raio",
  efeito_escurecer: "Efeito Escurecer",
}

const VISUAL_EFFECT_OPTIONS: VisualEffectAsset["effect_key"][] = [
  "efeito_texto",
  "efeito_brilho",
  "efeito_tremer",
  "efeito_flash",
  "efeito_particulas",
  "efeito_explosao",
  "efeito_raio",
  "efeito_escurecer",
]

export default function TrimPlayerAdminPage() {
  const [items, setItems] = useState<AudioAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState("")
  const [msgTipo, setMsgTipo] = useState<"ok" | "erro" | "info">("info")
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const [visualItems, setVisualItems] = useState<VisualEffectAsset[]>([])
  const [visualLoading, setVisualLoading] = useState(true)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const savedTimerRef = useRef<number | null>(null)
  const audioFileInputRefs = useRef<Partial<Record<(typeof ORDER)[number], HTMLInputElement | null>>>({})
  const [visualEffectToAdd, setVisualEffectToAdd] = useState<Record<VisualEffectAsset["event_key"], VisualEffectAsset["effect_key"]>>({
    combo1: "efeito_texto",
    combo2: "efeito_texto",
    combo3: "efeito_texto",
    combo4: "efeito_texto",
    combo5: "efeito_texto",
    victory: "efeito_texto",
    gameover: "efeito_texto",
  })

  const grouped = useMemo(() => {
    const map = new Map<string, AudioAsset[]>()
    for (const c of ORDER) map.set(c, [])
    for (const x of items) {
      const arr = map.get(x.category)
      if (arr) arr.push(x)
    }
    for (const c of ORDER) {
      const arr = map.get(c)!
      arr.sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [items])

  const visualGrouped = useMemo(() => {
    const map = new Map<VisualEffectAsset["event_key"], VisualEffectAsset[]>()
    for (const e of VISUAL_EVENTS) map.set(e, [])
    for (const x of visualItems) {
      const arr = map.get(x.event_key)
      if (arr) arr.push(x)
    }
    for (const e of VISUAL_EVENTS) {
      const arr = map.get(e)!
      arr.sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [visualItems])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/trimplay/audio-assets", { credentials: "include" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Erro ao carregar")
      setItems(Array.isArray(j.items) ? (j.items as AudioAsset[]) : [])
      if (typeof j.warning === "string" && j.warning.trim()) {
        setMsg(j.warning)
        setMsgTipo("info")
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar")
      setMsgTipo("erro")
    } finally {
      setLoading(false)
    }
  }

  const loadVisuals = async (preserveIfEmpty = false) => {
    setVisualLoading(true)
    try {
      const r = await fetch("/api/admin/trimplay/visual-effects", { credentials: "include" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Erro ao carregar efeitos visuais")
      const loaded = Array.isArray(j.items) ? (j.items as VisualEffectAsset[]) : []
      if (preserveIfEmpty && loaded.length === 0) {
        // Evita “zerar” a UI caso o backend retorne vazio por auth/migração.
        setMsg("Aviso: backend retornou 0 efeitos visuais. Mantive a lista atual.")
        setMsgTipo("info")
      } else {
        setVisualItems(loaded)
      }
      if (typeof j.warning === "string" && j.warning.trim()) {
        setMsg(j.warning)
        setMsgTipo("info")
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao carregar efeitos visuais")
      setMsgTipo("erro")
    } finally {
      setVisualLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void loadVisuals()
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
      previewRef.current?.pause()
    }
  }, [])

  const updateLocal = (id: string, patch: Partial<AudioAsset>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const updateLocalVisual = (id: string, patch: Partial<VisualEffectAsset>) => {
    setVisualItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const trimPlay = (asset: AudioAsset) => {
    if (!asset.file_url) return
    if (asset.trim_end_sec <= asset.trim_start_sec) {
      setMsg("tempoFinal deve ser maior que tempoInicial")
      return
    }
    if (asset.trim_end_sec - asset.trim_start_sec > 5) {
      setMsg("Trecho máximo de 5 segundos")
      return
    }
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
    if (!previewRef.current) previewRef.current = new Audio()
    const a = previewRef.current
    a.pause()
    a.src = asset.file_url
    a.volume = Math.max(0, Math.min(1, asset.volume))
    a.currentTime = asset.trim_start_sec
    void a.play()
    const durationMs = Math.max(0, (asset.trim_end_sec - asset.trim_start_sec) * 1000)
    stopTimerRef.current = window.setTimeout(() => {
      a.pause()
    }, durationMs)
  }

  const uploadAndCreate = async (category: string, file: File) => {
    setBusyId(`${category}-upload`)
    setMsg("")
    try {
      if (file.size > TRIMPLAY_AUDIO_MAX_BYTES) {
        throw new Error(
          `Arquivo muito grande (máx. ~${Math.round(TRIMPLAY_AUDIO_MAX_BYTES / (1024 * 1024))} MB). Tamanho: ${(file.size / (1024 * 1024)).toFixed(1)} MB.`
        )
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl?.trim() || !supabaseAnon?.trim()) {
        throw new Error(
          "Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente do site (configure na Vercel → Environment Variables)."
        )
      }

      const init = await fetch("/api/admin/trimplay/audio-upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          file_name: file.name,
          content_type: file.type || "audio/mpeg",
          size: file.size,
        }),
      })
      const initJson = (await init.json().catch(() => ({}))) as {
        error?: string
        hint?: string
        path?: string
        token?: string
        file_url?: string
        file_name?: string
      }
      if (!init.ok) {
        const detail =
          typeof initJson.error === "string"
            ? initJson.error
            : `Erro ao preparar upload (${init.status})`
        const hint = typeof initJson.hint === "string" ? initJson.hint : ""
        throw new Error(hint ? `${detail}\n\n${hint}` : detail)
      }

      const path = String(initJson.path ?? "")
      const token = String(initJson.token ?? "")
      const fileUrl = String(initJson.file_url ?? "")
      const savedName = String(initJson.file_name ?? file.name)
      if (!path || !token || !fileUrl) {
        throw new Error("Resposta inválida do servidor ao preparar o upload.")
      }

      const sb = createClient(supabaseUrl, supabaseAnon)
      const { error: upErr } = await sb.storage.from(TRIMPLAY_AUDIO_BUCKET).uploadToSignedUrl(path, token, file, {
        contentType: file.type || "audio/mpeg",
        upsert: false,
      })
      if (upErr) {
        throw new Error(
          `${upErr.message}\n\nO ficheiro vai direto ao Supabase. Confirme que NEXT_PUBLIC_SUPABASE_URL aponta para o mesmo projeto onde está o bucket "${TRIMPLAY_AUDIO_BUCKET}".`
        )
      }

      const create = await fetch("/api/admin/trimplay/audio-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          file_url: fileUrl,
          file_name: savedName,
          trim_start_sec: 0,
          trim_end_sec: 2,
          volume: 1,
          enabled: true,
        }),
      })
      const cj = await create.json().catch(() => ({}))
      if (!create.ok) throw new Error(typeof cj.error === "string" ? cj.error : "Erro ao criar áudio")
      const created = (cj.item ?? null) as AudioAsset | null
      const createdId = created?.id ?? null
      setMsg(`${LABELS[category as (typeof ORDER)[number]]}: áudio adicionado com sucesso`)
      setMsgTipo("ok")
      if (created) {
        setItems((prev) => [...prev, created])
      } else {
        await load()
      }
      if (createdId) {
        setLastAddedId(createdId)
        window.setTimeout(() => setLastAddedId((id) => (id === createdId ? null : id)), 3500)
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro de upload")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  const saveAsset = async (asset: AudioAsset) => {
    setBusyId(asset.id)
    setMsg("")
    try {
      const r = await fetch(`/api/admin/trimplay/audio-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trim_start_sec: asset.trim_start_sec,
          trim_end_sec: asset.trim_end_sec,
          volume: asset.volume,
          enabled: asset.enabled,
          sort_order: asset.sort_order,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Erro ao salvar")
      setMsg("Áudio salvo")
      setMsgTipo("ok")
      setLastSavedId(asset.id)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
      savedTimerRef.current = window.setTimeout(() => {
        setLastSavedId((id) => (id === asset.id ? null : id))
      }, 3000)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  const removeAsset = async (id: string) => {
    setBusyId(id)
    setMsg("")
    try {
      const r = await fetch(`/api/admin/trimplay/audio-assets/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Erro ao remover")
      setMsg("Áudio removido")
      setMsgTipo("ok")
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  const moveAsset = (category: string, id: string, direction: "up" | "down") => {
    const list = (grouped.get(category) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) return
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    const a = list[idx]!
    const b = list[swapIdx]!
    updateLocal(a.id, { sort_order: b.sort_order })
    updateLocal(b.id, { sort_order: a.sort_order })
  }

  const saveOrdering = async (category: string) => {
    const list = (grouped.get(category) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    if (list.length <= 1) return
    setBusyId(`${category}-order`)
    setMsg("")
    try {
      for (let i = 0; i < list.length; i++) {
        const asset = list[i]!
        await fetch(`/api/admin/trimplay/audio-assets/${asset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sort_order: i }),
        })
      }
      setMsg(`${LABELS[category as (typeof ORDER)[number]]}: ordem salva`)
      await load()
    } catch {
      setMsg("Erro ao salvar ordem")
    } finally {
      setBusyId(null)
    }
  }

  const addVisualEffect = async (eventKey: VisualEffectAsset["event_key"], effectKey: VisualEffectAsset["effect_key"]) => {
    setBusyId(`visual-${eventKey}-add`)
    setMsg("")
    try {
      const r = await fetch("/api/admin/trimplay/visual-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event_key: eventKey, effect_key: effectKey, enabled: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok)
        throw new Error(
          `Erro (${r.status}): ${typeof j.error === "string" ? j.error : "Erro ao adicionar efeito"}`
        )

      const created = j.item as VisualEffectAsset | undefined
      if (created?.id) {
        setVisualItems((prev) => [...prev, created])
        setLastAddedId(created.id)
        window.setTimeout(() => setLastAddedId((id) => (id === created.id ? null : id)), 3500)
      } else {
        await loadVisuals(true)
      }

      setMsg(`${VISUAL_EVENT_LABELS[eventKey]}: efeito adicionado`)
      setMsgTipo("ok")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao adicionar efeito")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  const patchVisualEnabled = async (asset: VisualEffectAsset, enabled: boolean) => {
    setBusyId(asset.id)
    setMsg("")
    try {
      const r = await fetch(`/api/admin/trimplay/visual-effects/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Erro ao salvar efeito")

      updateLocalVisual(asset.id, { enabled })
      setMsg("Efeito atualizado")
      setMsgTipo("ok")
      setLastSavedId(asset.id)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
      savedTimerRef.current = window.setTimeout(() => {
        setLastSavedId((id) => (id === asset.id ? null : id))
      }, 3000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar efeito")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  const removeVisualEffect = async (id: string) => {
    setBusyId(id)
    setMsg("")
    try {
      const r = await fetch(`/api/admin/trimplay/visual-effects/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Erro ao remover efeito")

      setMsg("Efeito removido")
      setMsgTipo("ok")
      await loadVisuals()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao remover efeito")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  const moveVisualEffect = (eventKey: VisualEffectAsset["event_key"], id: string, direction: "up" | "down") => {
    const list = (visualGrouped.get(eventKey) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const idx = list.findIndex((x) => x.id === id)
    if (idx < 0) return
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return

    const a = list[idx]!
    const b = list[swapIdx]!
    updateLocalVisual(a.id, { sort_order: b.sort_order })
    updateLocalVisual(b.id, { sort_order: a.sort_order })
  }

  const saveVisualOrdering = async (eventKey: VisualEffectAsset["event_key"]) => {
    const list = (visualGrouped.get(eventKey) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    if (list.length <= 1) return
    setBusyId(`${eventKey}-visual-order`)
    setMsg("")
    try {
      for (let i = 0; i < list.length; i++) {
        const asset = list[i]!
        const r = await fetch(`/api/admin/trimplay/visual-effects/${asset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sort_order: i }),
        })
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(`Erro (${r.status}): ${typeof j.error === "string" ? j.error : "Erro ao salvar ordem"}`)
        }
      }
      setMsg(`${VISUAL_EVENT_LABELS[eventKey]}: ordem salva`)
      setMsgTipo("ok")
      setLastSavedId(`${eventKey}-visual-order`)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
      savedTimerRef.current = window.setTimeout(() => {
        setLastSavedId((id) => (id === `${eventKey}-visual-order` ? null : id))
      }, 3000)
      await loadVisuals(true)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar ordem")
      setMsgTipo("erro")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trim Player</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Áudio e efeitos visuais: em telas largas, configuração de som à esquerda e efeitos na tela à direita; no celular, uma coluna abaixo da outra.
        </p>
      </div>
      {msg ? (
        <div
          className={[
            "text-sm rounded-md border px-3 py-2 whitespace-pre-wrap",
            msgTipo === "ok"
              ? "text-emerald-200 border-emerald-500/40 bg-emerald-500/10"
              : msgTipo === "erro"
                ? "text-red-200 border-red-500/40 bg-red-500/10"
                : "text-[#D4AF37] border-[#D4AF37]/40 bg-[#D4AF37]/10",
          ].join(" ")}
        >
          {msg}
        </div>
      ) : null}
      {loading || visualLoading ? (
        <p className="text-zinc-400">Carregando…</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start">
        <section className="space-y-4 min-w-0">
          <div className="rounded-lg border border-[#D4AF37]/25 bg-zinc-950/80 px-4 py-3">
            <h2 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Áudio (admin)</h2>
            <p className="text-xs text-zinc-500 mt-1">Upload, corte e teste por categoria (combos, vitória e fim de jogo).</p>
          </div>
          <div className="grid gap-4">
        {ORDER.map((category) => (
          <Card key={category} className="bg-zinc-950 border-[#D4AF37]/35 text-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#D4AF37]" />
                  <span className="font-semibold">{LABELS[category]}</span>
                </div>
                <input
                  ref={(el) => {
                    audioFileInputRefs.current[category] = el
                  }}
                  type="file"
                  accept=".mp3,.wav,.mpeg,audio/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ""
                    if (f) void uploadAndCreate(category, f)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="inline-flex items-center gap-2 border-[#D4AF37]/45 hover:bg-[#D4AF37]/10 text-white shrink-0"
                  disabled={busyId === `${category}-upload`}
                  onClick={() => audioFileInputRefs.current[category]?.click()}
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <Plus className="w-4 h-4 shrink-0" />
                  {busyId === `${category}-upload` ? "Enviando…" : "Adicionar áudio"}
                </Button>
              </div>

              {(grouped.get(category) ?? []).length === 0 ? (
                <p className="text-sm text-zinc-400">Sem áudios nesta categoria.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    {(grouped.get(category) ?? []).length} áudio(s) cadastrado(s)
                  </p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#D4AF37]/50"
                      onClick={() => void saveOrdering(category)}
                      disabled={busyId === `${category}-order`}
                    >
                      {busyId === `${category}-order` ? "Salvando ordem..." : "Salvar sequência"}
                    </Button>
                  </div>
                  {(grouped.get(category) ?? []).map((asset) => (
                    <div
                      key={asset.id}
                      className={[
                        "rounded-lg border p-3 space-y-3 transition-colors",
                        lastAddedId === asset.id
                          ? "border-emerald-400/70 bg-emerald-500/10"
                          : "border-[#D4AF37]/20",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-zinc-200">{asset.file_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400">Ativo</span>
                          <Switch
                            checked={asset.enabled}
                            onCheckedChange={(v) => updateLocal(asset.id, { enabled: v })}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-5 gap-2">
                        <Input
                          value={asset.file_url}
                          onChange={(e) => updateLocal(asset.id, { file_url: e.target.value.trim() })}
                          className="md:col-span-2 bg-zinc-900 border-[#D4AF37]/25"
                          placeholder="URL"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={asset.trim_start_sec}
                          onChange={(e) => updateLocal(asset.id, { trim_start_sec: Math.max(0, Number(e.target.value) || 0) })}
                          className={[
                            "bg-zinc-900",
                            asset.trim_end_sec > asset.trim_start_sec && asset.trim_end_sec - asset.trim_start_sec <= 5
                              ? "border-emerald-500/45"
                              : "border-red-500/50",
                          ].join(" ")}
                          placeholder="tempoInicial (s)"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={asset.trim_end_sec}
                          onChange={(e) => updateLocal(asset.id, { trim_end_sec: Math.max(0, Number(e.target.value) || 0) })}
                          className={[
                            "bg-zinc-900",
                            asset.trim_end_sec > asset.trim_start_sec && asset.trim_end_sec - asset.trim_start_sec <= 5
                              ? "border-emerald-500/45"
                              : "border-red-500/50",
                          ].join(" ")}
                          placeholder="tempoFinal (s)"
                        />
                        <Input
                          type="number"
                          step="0.05"
                          min={0}
                          max={1.5}
                          value={asset.volume}
                          onChange={(e) => updateLocal(asset.id, { volume: Math.max(0, Math.min(1.5, Number(e.target.value) || 1)) })}
                          className="bg-zinc-900 border-[#D4AF37]/25"
                          placeholder="Volume"
                        />
                      </div>
                      <div
                        className={[
                          "text-xs",
                          asset.trim_end_sec > asset.trim_start_sec && asset.trim_end_sec - asset.trim_start_sec <= 5
                            ? "text-emerald-300"
                            : "text-red-300",
                        ].join(" ")}
                      >
                        Duração do corte: {(asset.trim_end_sec - asset.trim_start_sec).toFixed(2)}s{" "}
                        {asset.trim_end_sec <= asset.trim_start_sec
                          ? "(tempoFinal precisa ser maior)"
                          : asset.trim_end_sec - asset.trim_start_sec > 5
                            ? "(máximo 5s)"
                            : "(ok)"}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[#D4AF37]/50"
                          onClick={() => moveAsset(category, asset.id, "up")}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[#D4AF37]/50"
                          onClick={() => moveAsset(category, asset.id, "down")}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="outline" className="border-[#D4AF37]/50" onClick={() => trimPlay(asset)}>
                          <Play className="w-4 h-4 mr-1.5" />
                          Testar corte (Trim Play)
                        </Button>
                        <Button
                          type="button"
                          className="bg-[#D4AF37] text-black hover:bg-[#c9a227]"
                          onClick={() => void saveAsset(asset)}
                          disabled={busyId === asset.id}
                        >
                          <Save
                            className={[
                              "w-4 h-4 mr-1.5 transition-colors",
                              lastSavedId === asset.id ? "text-emerald-600" : "text-black",
                            ].join(" ")}
                          />
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                          onClick={() => void removeAsset(asset.id)}
                          disabled={busyId === asset.id}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
          </div>
        </section>

        <section className="space-y-4 min-w-0 lg:border-l lg:border-[#D4AF37]/20 lg:pl-8 lg:sticky lg:top-6">
          <div className="rounded-lg border border-[#D4AF37]/25 bg-zinc-950/80 px-4 py-3">
            <h2 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Efeitos visuais</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Cada evento executa efeitos em sequência (loop). O jogo alterna automaticamente entre os itens da lista.
            </p>
          </div>

        <div className="grid gap-4">
          {VISUAL_EVENTS.map((eventKey) => (
            <Card key={eventKey} className="bg-zinc-950 border-[#D4AF37]/35 text-white">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-[#D4AF37]" />
                    <span className="font-semibold">{VISUAL_EVENT_LABELS[eventKey]}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{(visualGrouped.get(eventKey) ?? []).length} efeito(s)</p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={visualEffectToAdd[eventKey]}
                    onChange={(e) =>
                      setVisualEffectToAdd((prev) => ({
                        ...prev,
                        [eventKey]: e.target.value as VisualEffectAsset["effect_key"],
                      }))
                    }
                    className="bg-zinc-900 border-[#D4AF37]/25 text-white text-sm rounded-md px-3 py-2 focus:outline-none"
                  >
                    {VISUAL_EFFECT_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {VISUAL_EFFECT_LABELS[k]}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#D4AF37]/50 text-white"
                    onClick={() => void addVisualEffect(eventKey, visualEffectToAdd[eventKey])}
                    disabled={busyId === `visual-${eventKey}-add`}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adicionar efeito
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className={[
                      "border-[#D4AF37]/50",
                      lastSavedId === `${eventKey}-visual-order` ? "border-emerald-500/60 text-emerald-300" : "",
                    ].join(" ")}
                    onClick={() => void saveVisualOrdering(eventKey)}
                    disabled={busyId === `${eventKey}-visual-order`}
                  >
                    {busyId === `${eventKey}-visual-order` ? (
                      "Salvando ordem..."
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Save
                          className={[
                            "w-4 h-4",
                            lastSavedId === `${eventKey}-visual-order` ? "text-emerald-600" : "text-[#D4AF37]",
                          ].join(" ")}
                        />
                        Salvar sequência
                      </span>
                    )}
                  </Button>
                </div>

                {(visualGrouped.get(eventKey) ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-400">Sem efeitos visuais nesta categoria.</p>
                ) : (
                  <div className="space-y-3">
                    {(visualGrouped.get(eventKey) ?? []).map((asset) => (
                      <div
                        key={asset.id}
                        className={[
                          "rounded-lg border p-3 space-y-3 transition-colors",
                          lastAddedId === asset.id
                            ? "border-emerald-400/70 bg-emerald-500/10"
                            : "border-[#D4AF37]/20",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-zinc-200">
                            {VISUAL_EFFECT_LABELS[asset.effect_key] ?? asset.effect_key}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-400">Ativo</span>
                            <Switch
                              checked={asset.enabled}
                              disabled={busyId === asset.id}
                              onCheckedChange={(v) => void patchVisualEnabled(asset, v)}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-[#D4AF37]/50"
                            onClick={() => moveVisualEffect(eventKey, asset.id, "up")}
                            disabled={busyId === asset.id}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-[#D4AF37]/50"
                            onClick={() => moveVisualEffect(eventKey, asset.id, "down")}
                            disabled={busyId === asset.id}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                            onClick={() => void removeVisualEffect(asset.id)}
                            disabled={busyId === asset.id}
                          >
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        </section>
      </div>
    </div>
  )
}
