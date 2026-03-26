"use client"

import { useMemo, useRef, useState, useEffect } from "react"
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

const ORDER = ["combo1", "combo2", "combo3", "combo4", "gameover", "victory"] as const
const LABELS: Record<(typeof ORDER)[number], string> = {
  combo1: "COMBO_1",
  combo2: "COMBO_2",
  combo3: "COMBO_3",
  combo4: "COMBO_4",
  gameover: "GAME_OVER",
  victory: "VITORIA",
}

export default function TrimPlayerAdminPage() {
  const [items, setItems] = useState<AudioAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState("")
  const [msgTipo, setMsgTipo] = useState<"ok" | "erro" | "info">("info")
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const savedTimerRef = useRef<number | null>(null)

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

  useEffect(() => {
    void load()
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
      previewRef.current?.pause()
    }
  }, [])

  const updateLocal = (id: string, patch: Partial<AudioAsset>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
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
      const form = new FormData()
      form.set("category", category)
      form.set("file", file)
      const up = await fetch("/api/admin/trimplay/audio-upload", {
        method: "POST",
        body: form,
        credentials: "include",
      })
      const upJson = await up.json().catch(() => ({}))
      if (!up.ok) throw new Error(typeof upJson.error === "string" ? upJson.error : "Erro de upload")

      const create = await fetch("/api/admin/trimplay/audio-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category,
          file_url: String(upJson.file_url ?? ""),
          file_name: String(upJson.file_name ?? file.name),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trim Player</h1>
        <p className="text-zinc-400 text-sm mt-1">Envio, corte e teste de áudio por categoria (combos, vitória e fim de jogo).</p>
      </div>
      {msg ? (
        <div
          className={[
            "text-sm rounded-md border px-3 py-2",
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
      {loading ? <p className="text-zinc-400">Carregando…</p> : null}

      <div className="grid gap-4">
        {ORDER.map((category) => (
          <Card key={category} className="bg-zinc-950 border-[#D4AF37]/35 text-white">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#D4AF37]" />
                  <span className="font-semibold">{LABELS[category]}</span>
                </div>
                <label className="inline-flex items-center justify-center gap-2 rounded-md border border-[#D4AF37]/45 px-3 py-2 text-sm cursor-pointer hover:bg-[#D4AF37]/10">
                  <Upload className="w-4 h-4" />
                  <Plus className="w-4 h-4" />
                  Adicionar áudio
                  <input
                    type="file"
                    accept=".mp3,.wav,.mpeg,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadAndCreate(category, f)
                    }}
                  />
                </label>
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
    </div>
  )
}
