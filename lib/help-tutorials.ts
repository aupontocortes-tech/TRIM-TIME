export type HelpTutorialVideo = {
  id: string
  title: string
  description?: string
  /** Link do YouTube (watch, youtu.be ou embed). */
  youtube_url?: string
  youtube_id?: string
  /** Upload direto no Supabase (alternativa ao YouTube). */
  video_url?: string
  file_name?: string
  sort_order: number
  active: boolean
}

export type HelpTutorialTopic = {
  id: string
  title: string
  sort_order: number
  active: boolean
  videos: HelpTutorialVideo[]
}

export type HelpTutorialsConfig = {
  topics: HelpTutorialTopic[]
}

export const EMPTY_HELP_TUTORIALS: HelpTutorialsConfig = { topics: [] }

export const HELP_TUTORIAL_TOPIC_SUGGESTIONS = [
  "Primeiros passos no Trim Time",
  "Como agendar atendimentos",
  "Cadastrar serviços",
  "Cadastrar funcionários",
  "Conectar o WhatsApp",
  "Configurar notificações",
  "Plano e pagamento",
] as const

export function newHelpId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Extrai ID de vídeo do YouTube (watch, youtu.be, embed ou ID puro). */
export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (/^[\w-]{11}$/.test(raw)) return raw
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/watch\?v=)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`
}

export function helpTutorialUsesYoutube(v: HelpTutorialVideo): boolean {
  return !!resolveYoutubeId(v)
}

export function resolveYoutubeId(v: HelpTutorialVideo): string | null {
  return (
    extractYoutubeVideoId(v.youtube_url ?? "") ||
    extractYoutubeVideoId(v.youtube_id ?? "") ||
    null
  )
}

function isValidUploadUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function helpTutorialVideoReady(v: HelpTutorialVideo): boolean {
  if (resolveYoutubeId(v)) return true
  const url = v.video_url?.trim() ?? ""
  return !!url && isValidUploadUrl(url)
}

function normalizeVideo(raw: unknown, index: number): HelpTutorialVideo | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  if (!title) return null

  const youtubeUrl = typeof o.youtube_url === "string" ? o.youtube_url.trim() : ""
  const youtubeIdRaw = typeof o.youtube_id === "string" ? o.youtube_id.trim() : ""
  const youtubeId = extractYoutubeVideoId(youtubeUrl) || extractYoutubeVideoId(youtubeIdRaw) || ""
  const videoUrl = typeof o.video_url === "string" ? o.video_url.trim() : ""

  if (!youtubeId && (!videoUrl || !isValidUploadUrl(videoUrl))) return null

  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newHelpId("vid")
  const fileName = typeof o.file_name === "string" ? o.file_name.trim() : undefined
  const description = typeof o.description === "string" ? o.description.trim() : undefined
  const sortOrder =
    typeof o.sort_order === "number" && Number.isFinite(o.sort_order)
      ? Math.round(o.sort_order)
      : index
  const active = o.active !== false

  return {
    id,
    title,
    description: description || undefined,
    youtube_url: youtubeId ? youtubeUrl || youtubeWatchUrl(youtubeId) : undefined,
    youtube_id: youtubeId || undefined,
    video_url: !youtubeId && videoUrl ? videoUrl : undefined,
    file_name: fileName || undefined,
    sort_order: sortOrder,
    active,
  }
}

function normalizeTopic(raw: unknown, index: number): HelpTutorialTopic | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  if (!title) return null
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newHelpId("topic")
  const sortOrder =
    typeof o.sort_order === "number" && Number.isFinite(o.sort_order)
      ? Math.round(o.sort_order)
      : index
  const active = o.active !== false
  const videosRaw = Array.isArray(o.videos) ? o.videos : []
  const videos = videosRaw
    .map((v, i) => normalizeVideo(v, i))
    .filter((v): v is HelpTutorialVideo => v != null)
    .sort((a, b) => a.sort_order - b.sort_order)
  return { id, title, sort_order: sortOrder, active, videos }
}

export function parseHelpTutorials(raw: unknown, opts?: { includeInactive?: boolean }): HelpTutorialsConfig {
  const includeInactive = opts?.includeInactive === true
  const root = raw && typeof raw === "object" ? (raw as { topics?: unknown }) : null
  const topicsRaw = Array.isArray(root?.topics) ? root.topics : []
  const topics = topicsRaw
    .map((t, i) => normalizeTopic(t, i))
    .filter((t): t is HelpTutorialTopic => t != null)
    .map((topic) => ({
      ...topic,
      videos: topic.videos.filter((v) => includeInactive || v.active),
    }))
    .filter((topic) => includeInactive || topic.active)
    .filter((topic) => includeInactive || topic.videos.length > 0)
    .sort((a, b) => a.sort_order - b.sort_order)
  return { topics }
}

export function validateHelpTutorialsInput(raw: unknown): { ok: true; data: HelpTutorialsConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Formato inválido." }
  }
  const topicsRaw = (raw as { topics?: unknown }).topics
  if (!Array.isArray(topicsRaw)) {
    return { ok: false, error: "Informe a lista de tópicos." }
  }
  const topics: HelpTutorialTopic[] = []
  for (let i = 0; i < topicsRaw.length; i++) {
    const topic = normalizeTopic(topicsRaw[i], i)
    if (!topic) {
      return { ok: false, error: `Tópico ${i + 1}: título obrigatório.` }
    }
    for (const v of topic.videos) {
      if (!helpTutorialVideoReady(v)) {
        return {
          ok: false,
          error: `Vídeo "${v.title}": cole um link do YouTube ou envie um arquivo .mp4.`,
        }
      }
      if (!resolveYoutubeId(v) && !isValidUploadUrl(v.video_url ?? "")) {
        return { ok: false, error: `Vídeo "${v.title}": link do YouTube inválido.` }
      }
      if (resolveYoutubeId(v)) continue
      if (!v.video_url?.trim()) {
        return { ok: false, error: `Vídeo "${v.title}": envie o arquivo ou use YouTube.` }
      }
    }
    topics.push(topic)
  }
  return { ok: true, data: { topics } }
}
