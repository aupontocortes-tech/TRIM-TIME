"use client"

import { useEffect, useRef, useState } from "react"

const SPLASH_SRC = "/trim-play-splash.png"
/** Tempo mínimo para o jogador ver o logo antes do tabuleiro */
const DISPLAY_MS = 2600

type Props = {
  onComplete: () => void
}

/**
 * Tela cheia preta com logo TRIM PLAY ao iniciar o jogo (após “Jogar”).
 */
export function TrimPlaySplash({ onComplete }: Props) {
  const [fadeOut, setFadeOut] = useState(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const end = () => {
      setFadeOut(true)
      window.setTimeout(() => onCompleteRef.current(), 320)
    }
    const id = window.setTimeout(end, DISPLAY_MS)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div
      className={[
        "fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-black px-6",
        "transition-opacity duration-300 motion-reduce:transition-none",
        fadeOut ? "opacity-0" : "opacity-100",
      ].join(" ")}
      role="status"
      aria-busy="true"
      aria-label="Carregando Trim Play"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- splash estático em /public */}
      <img
        src={SPLASH_SRC}
        alt="Trim Play"
        className="max-w-[min(92vw,480px)] w-full h-auto object-contain select-none pointer-events-none drop-shadow-[0_0_40px_rgba(251,191,36,0.15)]"
        draggable={false}
      />
      <p className="mt-8 text-sm text-white/40 tracking-wide">Carregando…</p>
    </div>
  )
}
