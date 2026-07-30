"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  helpTutorialUsesYoutube,
  resolveYoutubeId,
  youtubeEmbedUrl,
  type HelpTutorialTopic,
  type HelpTutorialVideo,
} from "@/lib/help-tutorials"
import { BookOpen, CirclePlay, ExternalLink, Loader2, Play } from "lucide-react"
import { cn } from "@/lib/utils"

function totalVideos(topics: HelpTutorialTopic[]): number {
  return topics.reduce((n, t) => n + t.videos.length, 0)
}

function findVideoPosition(
  topics: HelpTutorialTopic[],
  videoId: string | undefined
): { topicIndex: number; videoIndex: number } | null {
  if (!videoId) return null
  for (let ti = 0; ti < topics.length; ti++) {
    const vi = topics[ti].videos.findIndex((v) => v.id === videoId)
    if (vi >= 0) return { topicIndex: ti, videoIndex: vi }
  }
  return null
}

export default function ComoUsarPage() {
  const [topics, setTopics] = useState<HelpTutorialTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [activeVideo, setActiveVideo] = useState<HelpTutorialVideo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch("/api/help-tutorials", { credentials: "include", cache: "no-store" })
      const j = await r.json()
      if (!r.ok) {
        setErr(j.error || "Não foi possível carregar os tutoriais")
        return
      }
      const list = Array.isArray(j.topics) ? (j.topics as HelpTutorialTopic[]) : []
      setTopics(list)
      const first = list[0]?.videos[0] ?? null
      setActiveVideo(first)
    } catch {
      setErr("Erro de rede")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeYoutubeId = activeVideo ? resolveYoutubeId(activeVideo) : null
  const activePos = findVideoPosition(topics, activeVideo?.id)
  const lessonCount = totalVideos(topics)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <CirclePlay className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Como usar</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Mini curso em vídeo — escolha o tópico que quiser assistir primeiro e avance no seu ritmo.
        </p>
      </div>

      {err ? (
        <div className="text-sm text-destructive border border-destructive/30 rounded-lg p-3">{err}</div>
      ) : null}

      {topics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Os tutoriais em vídeo ainda não foram publicados. Volte em breve ou fale com o suporte se
            precisar de ajuda agora.
            <div className="mt-4">
              <Button variant="outline" asChild>
                <Link href="/painel/suporte">Ir para Suporte</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          {activeVideo ? (
            <Card className="overflow-hidden border-primary/20 lg:sticky lg:top-4">
              <CardHeader className="pb-2">
                {activePos ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1">
                    Tópico {activePos.topicIndex + 1}
                    {topics[activePos.topicIndex]?.videos.length > 1
                      ? ` · Aula ${activePos.videoIndex + 1}`
                      : null}
                  </p>
                ) : null}
                <CardTitle className="text-lg">{activeVideo.title}</CardTitle>
                {activeVideo.description ? (
                  <CardDescription>{activeVideo.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                  {activeYoutubeId ? (
                    <iframe
                      key={activeVideo.id}
                      title={activeVideo.title}
                      src={`${youtubeEmbedUrl(activeYoutubeId)}?rel=0`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : activeVideo.video_url ? (
                    <video
                      key={activeVideo.id}
                      src={activeVideo.video_url}
                      controls
                      controlsList="nodownload"
                      className="absolute inset-0 w-full h-full"
                      preload="metadata"
                      playsInline
                    >
                      Seu navegador não suporta reprodução de vídeo.
                    </video>
                  ) : null}
                </div>
                {activeYoutubeId && activeVideo.youtube_url ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={activeVideo.youtube_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir no YouTube
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Selecione um tópico ao lado para começar.
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden lg:max-h-[calc(100vh-6rem)] lg:flex lg:flex-col">
            <CardHeader className="pb-3 shrink-0 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Conteúdo do curso</CardTitle>
                  <CardDescription>
                    {topics.length} {topics.length === 1 ? "tópico" : "tópicos"} · {lessonCount}{" "}
                    {lessonCount === 1 ? "aula" : "aulas"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 lg:overflow-y-auto">
              <div className="divide-y">
                {topics.map((topic, topicIndex) => {
                  const topicHasActive = topic.videos.some((v) => v.id === activeVideo?.id)
                  const singleVideo = topic.videos.length === 1 ? topic.videos[0] : null

                  return (
                    <div key={topic.id} className={cn(topicHasActive && "bg-primary/5")}>
                      {singleVideo ? (
                        <button
                          type="button"
                          onClick={() => setActiveVideo(singleVideo)}
                          className={cn(
                            "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-secondary/40",
                            activeVideo?.id === singleVideo.id && "bg-primary/10"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                              activeVideo?.id === singleVideo.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-foreground"
                            )}
                          >
                            {topicIndex + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                              Tópico {topicIndex + 1}
                            </span>
                            <span className="font-medium text-sm text-foreground block mt-0.5">
                              {topic.title}
                            </span>
                            {singleVideo.description ? (
                              <span className="text-xs text-muted-foreground line-clamp-2 mt-1 block">
                                {singleVideo.description}
                              </span>
                            ) : null}
                          </span>
                          <Play
                            className={cn(
                              "w-4 h-4 shrink-0 mt-1",
                              activeVideo?.id === singleVideo.id
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          />
                        </button>
                      ) : (
                        <>
                          <div className="px-4 py-3 flex items-start gap-3">
                            <span
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                topicHasActive
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-foreground"
                              )}
                            >
                              {topicIndex + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">
                                Tópico {topicIndex + 1}
                              </span>
                              <span className="font-medium text-sm text-foreground block mt-0.5">
                                {topic.title}
                              </span>
                              <span className="text-xs text-muted-foreground mt-0.5 block">
                                {topic.videos.length}{" "}
                                {topic.videos.length === 1 ? "aula" : "aulas"}
                              </span>
                            </span>
                          </div>
                          <div className="pb-2 space-y-0.5">
                            {topic.videos.map((video, videoIndex) => {
                              const selected = activeVideo?.id === video.id
                              return (
                                <button
                                  key={video.id}
                                  type="button"
                                  onClick={() => setActiveVideo(video)}
                                  className={cn(
                                    "w-full text-left pl-14 pr-4 py-2.5 flex items-start gap-2 transition-colors hover:bg-secondary/40",
                                    selected && "bg-primary/10"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                                      selected ? "bg-primary/20 text-primary" : "bg-muted"
                                    )}
                                  >
                                    <Play className="w-3 h-3" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="text-xs text-muted-foreground block">
                                      Aula {videoIndex + 1}
                                    </span>
                                    <span className="font-medium text-sm text-foreground block">
                                      {video.title}
                                    </span>
                                    {helpTutorialUsesYoutube(video) ? (
                                      <span className="text-[11px] text-muted-foreground/80 mt-0.5 block">
                                        YouTube
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
