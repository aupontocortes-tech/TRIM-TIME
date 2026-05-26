"use client"

import { useEffect, useRef, useState } from "react"

const SPLASH_SRC = "/trim-play-splash.png"
const DISPLAY_MS = 2600

type Props = {
  onComplete: () => void
}

/** Mesmo “horizonte” visual do TrimPlayGame — transição contínua para o tabuleiro */
const BG_LAYERS = (
  <>
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 100% 55% at 50% -12%, rgba(212, 175, 55, 0.18), transparent 50%), radial-gradient(ellipse 65% 45% at 95% 30%, rgba(70, 55, 18, 0.16), transparent), linear-gradient(180deg, #121212 0%, #070707 45%, #050505 100%)",
      }}
    />
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/18 via-amber-600/6 to-transparent"
    />
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-amber-700/12 via-amber-600/5 to-transparent"
    />
    {/* vinheta suave nas bordas */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        boxShadow: "inset 0 0 120px rgba(0,0,0,0.55), inset 0 0 40px rgba(0,0,0,0.35)",
      }}
    />
  </>
)

/**
 * Abertura do Trim Play: logo em destaque sobre o fundo do app (não tela preta chapada).
 */
export function TrimPlaySplash({ onComplete }: Props) {
  const [fadeOut, setFadeOut] = useState(false)
  const [entered, setEntered] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    const end = () => {
      setFadeOut(true)
      window.setTimeout(() => onCompleteRef.current(), 380)
    }
    const id = window.setTimeout(end, DISPLAY_MS)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div
      className={[
        "fixed inset-0 z-[100000] flex flex-col items-center justify-center px-5 sm:px-8",
        "transition-opacity duration-500 ease-out motion-reduce:transition-none",
        fadeOut ? "opacity-0" : "opacity-100",
      ].join(" ")}
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      role="status"
      aria-busy="true"
      aria-label="Carregando Trim Play"
    >
      <div className="absolute inset-0 overflow-hidden">{BG_LAYERS}</div>

      {/* conteúdo */}
      <div
        className={[
          "relative z-10 w-full max-w-[min(100%,420px)] flex flex-col items-center",
          "transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:scale-100",
          entered ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.97]",
        ].join(" ")}
      >
        {/* halo atrás do emblema */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-[min(100%,340px)] aspect-square rounded-full opacity-80 blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.22) 0%, rgba(180,140,40,0.08) 45%, transparent 70%)",
          }}
        />

        <div
          className={[
            "relative w-full rounded-[1.75rem] p-[1px]",
            "bg-gradient-to-br from-[#e8c547]/55 via-[#8a7328]/35 to-[#3d3318]/50",
            "shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_25px_80px_rgba(0,0,0,0.65),0_0_100px_rgba(212,175,55,0.12)]",
          ].join(" ")}
        >
          <div
            className={[
              "rounded-[1.7rem] overflow-hidden",
              "bg-gradient-to-b from-[#181611]/98 via-[#0e0e0c]/98 to-[#060605]/98",
              "backdrop-blur-sm",
              "shadow-[inset_0_1px_0_rgba(255,220,140,0.12),inset_0_-20px_40px_rgba(0,0,0,0.35)]",
            ].join(" ")}
          >
            <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- asset em /public */}
              <img
                src={SPLASH_SRC}
                alt="Trim Play"
                className="w-full h-auto max-h-[min(52vh,380px)] object-contain object-center mx-auto select-none pointer-events-none"
                style={{
                  filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.55)) drop-shadow(0 0 32px rgba(212,175,55,0.12))",
                }}
                draggable={false}
              />
            </div>
          </div>
        </div>

        <div className="mt-10 w-full max-w-[200px] space-y-3">
          <div
            className="h-0.5 w-full rounded-full bg-white/[0.08] overflow-hidden"
            role="presentation"
          >
            <div
              className="trimplay-splash-progress h-full w-full rounded-full bg-gradient-to-r from-[#6b5a28] via-[#e8c547] to-[#f5e6a8]"
            />
          </div>
          <p className="text-center text-[11px] sm:text-xs uppercase tracking-[0.2em] text-[#c9a227]/80 font-medium">
            Carregando
          </p>
        </div>
      </div>

    </div>
  )
}
