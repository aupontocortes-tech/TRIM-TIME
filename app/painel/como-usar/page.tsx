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
import { CirclePlay, ExternalLink, Loader2, Play } from "lucide-react"
import { cn } from "@/lib/utils"

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <CirclePlay className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Como usar</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Aprenda a usar o Trim Time com vídeos passo a passo — agenda, serviços, equipe, WhatsApp e
          mais.
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
        <>
          {activeVideo ? (
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="pb-2">
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
          ) : null}

          <div className="space-y-4">
            {topics.map((topic) => (
              <Card key={topic.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topic.videos.map((video) => {
                    const selected = activeVideo?.id === video.id
                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => setActiveVideo(video)}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-3 flex items-start gap-3 transition-colors",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-secondary/40"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            selected ? "bg-primary text-primary-foreground" : "bg-secondary"
                          )}
                        >
                          <Play className="w-4 h-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-sm text-foreground block">{video.title}</span>
                          {video.description ? (
                            <span className="text-xs text-muted-foreground line-clamp-2 mt-0.5 block">
                              {video.description}
                            </span>
                          ) : null}
                          {helpTutorialUsesYoutube(video) ? (
                            <span className="text-xs text-muted-foreground/80 mt-0.5 block">YouTube</span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
