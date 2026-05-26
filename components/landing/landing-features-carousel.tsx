"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"
import { LANDING_FEATURES } from "@/lib/landing-features"

const AUTOPLAY_MS = 3000

export function LandingFeaturesCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!api || paused) return
    const total = LANDING_FEATURES.length
    const timer = window.setInterval(() => {
      const next = (api.selectedScrollSnap() + 1) % total
      api.scrollTo(next)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [api, paused])

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-3xl opacity-30" />
      <Card className="relative bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          {/* Cabeçalho igual ao card “Agenda do Dia” */}
          <div className="bg-secondary/50 px-4 py-3.5 border-b border-border flex items-center justify-center min-h-[3.25rem]">
            <span
              className={cn(
                "text-center text-base sm:text-lg font-bold tracking-wide px-2 text-[var(--gold-light)]",
                "[text-shadow:0_1px_0_var(--gold-dark),0_2px_6px_rgba(0,0,0,0.9),0_0_20px_rgba(201,162,39,0.55)]"
              )}
            >
              Sua visão no Trim Time
            </span>
          </div>

          {/* Mesmo padding e altura da lista de 4 agendamentos */}
          <div className="p-4 space-y-3">
            <div className="grid overflow-hidden">
              {/* Mantém o enquadro exato da agenda (4 linhas) */}
              <div className="col-start-1 row-start-1 space-y-3 invisible pointer-events-none select-none" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-3 rounded-lg border border-transparent"
                  >
                    <div className="text-center min-w-[50px]">
                      <p className="text-sm font-semibold text-primary">00:00</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Nome</p>
                      <p className="text-xs text-muted-foreground">Serviço</p>
                    </div>
                    <div className="w-2 h-2 rounded-full" />
                  </div>
                ))}
              </div>

              {/* Carrossel ocupa todo o espaço da grade */}
              <div className="col-start-1 row-start-1 min-h-0 min-w-0 overflow-hidden size-full">
                <Carousel
                  setApi={setApi}
                  opts={{ loop: true, duration: 18, watchDrag: true }}
                  className="size-full [&_[data-slot=carousel-content]]:h-full"
                >
                  <CarouselContent className="-ml-0 h-full [&>div]:h-full">
                    {LANDING_FEATURES.map((feature) => {
                      const Icon = feature.icon
                      return (
                        <CarouselItem
                          key={feature.title}
                          className="pl-0 basis-full h-full min-w-0"
                        >
                          <div className="flex h-full w-full min-h-full flex-col items-center justify-center gap-5 px-4 py-3 text-center rounded-lg bg-secondary/30 border border-border/50">
                            <div
                              className={cn(
                                "flex h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem] items-center justify-center rounded-2xl ring-2 shrink-0",
                                feature.accent.bg,
                                feature.accent.ring,
                                feature.accent.glow
                              )}
                            >
                              <Icon
                                className={cn("h-10 w-10 sm:h-11 sm:w-11", feature.accent.icon)}
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </div>
                            <div className="flex flex-col items-center gap-2 w-full max-w-[320px]">
                              <p className="text-2xl sm:text-[1.65rem] font-bold text-primary leading-tight text-balance">
                                {feature.title}
                              </p>
                              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty line-clamp-4">
                                {feature.descriptionShort}
                              </p>
                            </div>
                          </div>
                        </CarouselItem>
                      )
                    })}
                  </CarouselContent>
                </Carousel>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
