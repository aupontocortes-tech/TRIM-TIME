"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  HELP_TUTORIAL_VIDEO_MAX_MB,
  HELP_TUTORIAL_VIDEO_BUCKET,
  HELP_TUTORIAL_VIDEO_MAX_BYTES,
} from "@/lib/help-tutorial-video-constants"
import {
  HELP_TUTORIAL_TOPIC_SUGGESTIONS,
  extractYoutubeVideoId,
  newHelpId,
  resolveYoutubeId,
  youtubeEmbedUrl,
  type HelpTutorialTopic,
  type HelpTutorialsConfig,
} from "@/lib/help-tutorials"
import { ArrowDown, ArrowUp, CirclePlay, Loader2, Pencil, Plus, Save, Trash2, Upload } from "lucide-react"
import { HelpTutorialVideoEditDialog } from "@/components/plataforma/help-tutorial-video-edit-dialog"

export default function PlataformaTutoriaisPage() {
  const [config, setConfig] = useState<HelpTutorialsConfig>({ topics: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editTarget, setEditTarget] = useState<{ topicId: string; videoId: string } | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/admin/help-tutorials", { credentials: "include" })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao carregar")
        return
      }
      setConfig({ topics: Array.isArray(j.topics) ? j.topics : [] })
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const r = await fetch("/api/admin/help-tutorials", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Erro ao salvar")
        return
      }
      setConfig({ topics: Array.isArray(j.topics) ? j.topics : config.topics })
      setMsg("Tutoriais salvos. Já aparecem no painel em Como usar.")
    } catch {
      setErr("Erro de rede")
    } finally {
      setSaving(false)
    }
  }

  const addTopic = (title?: string) => {
    const nextOrder = config.topics.length
    const topic: HelpTutorialTopic = {
      id: newHelpId("topic"),
      title: title ?? "Novo tópico",
      sort_order: nextOrder,
      active: true,
      videos: [],
    }
    setConfig((c) => ({ topics: [...c.topics, topic] }))
  }

  const updateTopic = (id: string, patch: Partial<HelpTutorialTopic>) => {
    setConfig((c) => ({
      topics: c.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  const removeTopic = (id: string) => {
    if (!confirm("Remover este tópico e todos os vídeos?")) return
    setConfig((c) => ({ topics: c.topics.filter((t) => t.id !== id) }))
  }

  const moveTopic = (index: number, dir: -1 | 1) => {
    const next = [...config.topics]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setConfig({
      topics: next.map((t, i) => ({ ...t, sort_order: i })),
    })
  }

  const addVideo = (topicId: string) => {
    setConfig((c) => ({
      topics: c.topics.map((t) =>
        t.id === topicId
          ? {
              ...t,
              videos: [
                ...t.videos,
                {
                  id: newHelpId("vid"),
                  title: "Novo vídeo",
                  youtube_url: "",
                  youtube_id: "",
                  sort_order: t.videos.length,
                  active: true,
                },
              ],
            }
          : t
      ),
    }))
  }

  const updateVideo = (
    topicId: string,
    videoId: string,
    patch: Partial<HelpTutorialTopic["videos"][number]>
  ) => {
    setConfig((c) => ({
      topics: c.topics.map((t) =>
        t.id === topicId
          ? {
              ...t,
              videos: t.videos.map((v) => {
                if (v.id !== videoId) return v
                const merged = { ...v, ...patch }
                if ("youtube_url" in patch) {
                  const id = extractYoutubeVideoId(merged.youtube_url ?? "")
                  merged.youtube_id = id ?? ""
                  if (id) {
                    merged.video_url = undefined
                    merged.file_name = undefined
                  }
                }
                return merged
              }),
            }
          : t
      ),
    }))
  }

  const removeVideo = (topicId: string, videoId: string) => {
    setConfig((c) => ({
      topics: c.topics.map((t) =>
        t.id === topicId ? { ...t, videos: t.videos.filter((v) => v.id !== videoId) } : t
      ),
    }))
  }

  const moveVideo = (topicId: string, index: number, dir: -1 | 1) => {
    setConfig((c) => ({
      topics: c.topics.map((t) => {
        if (t.id !== topicId) return t
        const vids = [...t.videos]
        const target = index + dir
        if (target < 0 || target >= vids.length) return t
        ;[vids[index], vids[target]] = [vids[target], vids[index]]
        return { ...t, videos: vids.map((v, i) => ({ ...v, sort_order: i })) }
      }),
    }))
  }

  const openEditor = (topicId: string, videoId: string, file: File) => {
    setEditTarget({ topicId, videoId })
    setEditFile(file)
    setEditOpen(true)
  }

  const openEditorFromUrl = async (topicId: string, videoId: string, url: string, fileName?: string) => {
    setLoadingEdit(true)
    setErr(null)
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error("Não foi possível baixar o vídeo para editar.")
      const blob = await r.blob()
      const name = fileName?.trim() || "tutorial.mp4"
      openEditor(topicId, videoId, new File([blob], name, { type: blob.type || "video/mp4" }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao abrir editor")
    } finally {
      setLoadingEdit(false)
    }
  }

  const uploadVideo = async (topicId: string, videoId: string, file: File) => {
    if (file.size > HELP_TUTORIAL_VIDEO_MAX_BYTES) {
      setErr(`Arquivo muito grande. Máximo ${HELP_TUTORIAL_VIDEO_MAX_MB} MB por vídeo.`)
      return
    }

    setUploadingVideoId(videoId)
    setErr(null)
    setMsg(null)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl?.trim() || !supabaseAnon?.trim()) {
        throw new Error("Supabase não configurado no ambiente do site.")
      }

      const init = await fetch("/api/admin/help-tutorials/video-upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type || "video/mp4",
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
        const detail = initJson.error ?? `Erro ao preparar upload (${init.status})`
        const hint = initJson.hint ? `\n\n${initJson.hint}` : ""
        throw new Error(detail + hint)
      }

      const path = String(initJson.path ?? "")
      const token = String(initJson.token ?? "")
      const fileUrl = String(initJson.file_url ?? "")
      const savedName = String(initJson.file_name ?? file.name)
      if (!path || !token || !fileUrl) {
        throw new Error("Resposta inválida do servidor ao preparar o upload.")
      }

      const sb = createClient(supabaseUrl, supabaseAnon)
      const { error: upErr } = await sb.storage
        .from(HELP_TUTORIAL_VIDEO_BUCKET)
        .uploadToSignedUrl(path, token, file, {
          contentType: file.type || "video/mp4",
          upsert: false,
        })
      if (upErr) {
        const em = upErr.message.toLowerCase()
        if (em.includes("maximum allowed size") || em.includes("entity too large")) {
          throw new Error(
            `Vídeo muito grande. Máximo ${HELP_TUTORIAL_VIDEO_MAX_MB} MB por arquivo. Comprima o .mp4 ou use o corte no editor antes de enviar.`
          )
        }
        throw new Error(
          `${upErr.message}\n\nConfirme o bucket "${HELP_TUTORIAL_VIDEO_BUCKET}" no Supabase.`
        )
      }

      updateVideo(topicId, videoId, {
        video_url: fileUrl,
        file_name: savedName,
        youtube_url: undefined,
        youtube_id: undefined,
      })
      setMsg(`Vídeo "${savedName}" enviado. Clique em Salvar tutoriais para publicar no painel.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar vídeo")
    } finally {
      setUploadingVideoId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-[#E8C872]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <CirclePlay className="w-8 h-8 text-[#9EEDE0]" />
          <h1
            className="text-2xl font-semibold text-[#F5EDD6]"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            Tutoriais em vídeo
          </h1>
        </div>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Configure os vídeos do painel <strong className="text-zinc-200">Como usar</strong> (mesmos para
          todas as barbearias). Cole o link do <strong className="text-zinc-200">YouTube</strong>{" "}
          (pode ser não listado) ou envie um .mp4.
        </p>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-300 whitespace-pre-wrap">
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          {msg}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => addTopic()}
          className="bg-[#E8C872]/20 text-[#FFE08A] border border-[#E8C872]/40 hover:bg-[#E8C872]/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo tópico
        </Button>
        {HELP_TUTORIAL_TOPIC_SUGGESTIONS.map((s) => (
          <Button
            key={s}
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-900"
            onClick={() => addTopic(s)}
          >
            + {s}
          </Button>
        ))}
      </div>

      {config.topics.length === 0 ? (
        <Card className="bg-zinc-950 border-zinc-800">
          <CardContent className="py-10 text-center text-zinc-500 text-sm">
            Nenhum tópico ainda. Clique em &quot;Novo tópico&quot; ou use uma sugestão acima.
          </CardContent>
        </Card>
      ) : (
        config.topics.map((topic, topicIndex) => (
          <Card key={topic.id} className="bg-zinc-950 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <CardTitle className="text-base text-zinc-100">Tópico</CardTitle>
                  <Input
                    value={topic.title}
                    onChange={(e) => updateTopic(topic.id, { title: e.target.value })}
                    className="bg-zinc-900 border-zinc-700 text-zinc-100"
                    placeholder="Ex.: Conectar o WhatsApp"
                  />
                  <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <Switch
                      checked={topic.active}
                      onCheckedChange={(v) => updateTopic(topic.id, { active: v })}
                    />
                    Visível no painel
                  </label>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="border-zinc-700"
                    disabled={topicIndex === 0}
                    onClick={() => moveTopic(topicIndex, -1)}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="border-zinc-700"
                    disabled={topicIndex === config.topics.length - 1}
                    onClick={() => moveTopic(topicIndex, 1)}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="border-red-900/50 text-red-400"
                    onClick={() => removeTopic(topic.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {topic.videos.map((video, videoIndex) => (
                <VideoEditor
                  key={video.id}
                  video={video}
                  videoIndex={videoIndex}
                  topicId={topic.id}
                  totalVideos={topic.videos.length}
                  uploading={uploadingVideoId === video.id}
                  onUpdate={(patch) => updateVideo(topic.id, video.id, patch)}
                  onRemove={() => removeVideo(topic.id, video.id)}
                  onMove={(dir) => moveVideo(topic.id, videoIndex, dir)}
                  onPickFile={(file) => openEditor(topic.id, video.id, file)}
                  onEditExisting={() => {
                    if (video.video_url) {
                      void openEditorFromUrl(topic.id, video.id, video.video_url, video.file_name)
                    }
                  }}
                  loadingEdit={loadingEdit && editTarget?.videoId === video.id}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300"
                onClick={() => addVideo(topic.id)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar vídeo
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      <Button
        type="button"
        disabled={saving || uploadingVideoId != null || editOpen}
        onClick={() => void save()}
        className="w-full sm:w-auto bg-[#E8C872] text-black hover:bg-[#FFE08A]"
      >
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Salvar tutoriais
      </Button>

      <HelpTutorialVideoEditDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditFile(null)
            setEditTarget(null)
          }
        }}
        sourceFile={editFile}
        onConfirm={async (file) => {
          if (!editTarget) return
          await uploadVideo(editTarget.topicId, editTarget.videoId, file)
        }}
      />
    </div>
  )
}

type VideoEditorProps = {
  video: HelpTutorialTopic["videos"][number]
  videoIndex: number
  topicId: string
  totalVideos: number
  uploading: boolean
  loadingEdit: boolean
  onUpdate: (patch: Partial<HelpTutorialTopic["videos"][number]>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onPickFile: (file: File) => void
  onEditExisting: () => void
}

function VideoEditor({
  video,
  videoIndex,
  totalVideos,
  uploading,
  loadingEdit,
  onUpdate,
  onRemove,
  onMove,
  onPickFile,
  onEditExisting,
}: VideoEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex flex-wrap gap-2 justify-between">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Vídeo {videoIndex + 1}
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={videoIndex === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={videoIndex === totalVideos - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-400"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <Input
        value={video.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        className="bg-zinc-950 border-zinc-700"
        placeholder="Título do vídeo"
      />
      <Textarea
        value={video.description ?? ""}
        onChange={(e) => onUpdate({ description: e.target.value })}
        className="bg-zinc-950 border-zinc-700 min-h-[60px]"
        placeholder="Descrição curta (opcional)"
      />
      <Input
        value={video.youtube_url ?? ""}
        onChange={(e) => onUpdate({ youtube_url: e.target.value })}
        className="bg-zinc-950 border-zinc-700 font-mono text-sm"
        placeholder="https://www.youtube.com/watch?v=..."
      />
      {resolveYoutubeId(video) ? (
        <div className="space-y-2">
          <p className="text-xs text-emerald-500/80">YouTube OK — pronto para salvar</p>
          <div className="relative w-full aspect-video max-h-48 rounded-md overflow-hidden bg-black">
            <iframe
              title={video.title}
              src={`${youtubeEmbedUrl(resolveYoutubeId(video)!)}?rel=0`}
              className="absolute inset-0 w-full h-full border-0"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-500/80">Cole um link válido do YouTube</p>
      )}
      <details className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
        <summary className="text-xs text-zinc-400 cursor-pointer select-none">
          Ou enviar arquivo .mp4 (até {HELP_TUTORIAL_VIDEO_MAX_MB} MB)
        </summary>
        <div className="flex flex-wrap items-center gap-2 pt-3">
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPickFile(file)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-zinc-600 text-zinc-200"
          disabled={uploading || loadingEdit}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {video.video_url ? "Trocar vídeo" : "Enviar vídeo"}
        </Button>
        {video.video_url ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-600 text-zinc-200"
            disabled={uploading || loadingEdit}
            onClick={onEditExisting}
          >
            {loadingEdit ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Pencil className="w-4 h-4 mr-2" />
            )}
            Editar vídeo
          </Button>
        ) : null}
        {video.file_name ? (
          <span className="text-xs text-zinc-400 truncate max-w-[240px]">{video.file_name}</span>
        ) : null}
        </div>
        {video.video_url && !resolveYoutubeId(video) ? (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-emerald-500/80">Arquivo enviado — pronto para salvar</p>
            <video
              src={video.video_url}
              controls
              className="w-full max-h-48 rounded-md bg-black"
              preload="metadata"
            />
          </div>
        ) : null}
      </details>
      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <Switch checked={video.active} onCheckedChange={(v) => onUpdate({ active: v })} />
        Publicado
      </label>
    </div>
  )
}
