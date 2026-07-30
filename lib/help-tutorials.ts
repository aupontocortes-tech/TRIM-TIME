export type HelpTutorialVideo = {
  id: string
  title: string
  description?: string
  video_url: string
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

/** Sugestões exibidas no Super ADM ao criar tópico. */
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

function isValidVideoUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

function normalizeVideo(raw: unknown, index: number): HelpTutorialVideo | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const videoUrl = typeof o.video_url === "string" ? o.video_url.trim() : ""
  if (!title || !videoUrl || !isValidVideoUrl(videoUrl)) return null
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
    video_url: videoUrl,
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

/** Normaliza JSON do banco para exibição no painel (só ativos). */
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
      if (!isValidVideoUrl(v.video_url)) {
        return { ok: false, error: `Vídeo "${v.title}": envie o arquivo de vídeo antes de salvar.` }
      }
    }
    topics.push(topic)
  }
  return { ok: true, data: { topics } }
}
