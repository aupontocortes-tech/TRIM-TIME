"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import {
  formatVideoTime,
  processHelpTutorialVideo,
  type HelpTutorialVideoEditOptions,
} from "@/lib/help-tutorial-video-process"
import {
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  RotateCw,
  Scissors,
} from "lucide-react"

type HelpTutorialVideoEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceFile: File | null
  onConfirm: (file: File) => void | Promise<void>
}

export function HelpTutorialVideoEditDialog({
  open,
  onOpenChange,
  sourceFile,
  onConfirm,
}: HelpTutorialVideoEditDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0])
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!sourceFile || !open) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(sourceFile)
    setObjectUrl(url)
    setFlipH(false)
    setFlipV(false)
    setRotation(0)
    setProgress(0)
    setStatus("")
    return () => URL.revokeObjectURL(url)
  }, [sourceFile, open])

  const previewTransform = useMemo(() => {
    const parts: string[] = []
    if (rotation) parts.push(`rotate(${rotation}deg)`)
    if (flipH) parts.push("scaleX(-1)")
    if (flipV) parts.push("scaleY(-1)")
    return parts.length ? parts.join(" ") : undefined
  }, [flipH, flipV, rotation])

  const onVideoMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v || !Number.isFinite(v.duration)) return
    const d = v.duration
    setDuration(d)
    setTrimRange([0, d])
  }, [])

  const enforceTrimPreview = useCallback(() => {
    const v = videoRef.current
    if (!v || duration <= 0) return
    const [start, end] = trimRange
    if (v.currentTime < start || v.currentTime > end) {
      v.currentTime = start
    }
  }, [duration, trimRange])

  const cycleRotation = () => {
    setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)
  }

  const hasEdits =
    trimRange[0] > 0.05 ||
    (duration > 0 && trimRange[1] < duration - 0.05) ||
    flipH ||
    flipV ||
    rotation !== 0

  const handleApply = async () => {
    if (!sourceFile) return
    setProcessing(true)
    setProgress(0)
    setStatus("Iniciando…")
    try {
      const opts: HelpTutorialVideoEditOptions = {
        trimStartSec: trimRange[0],
        trimEndSec: trimRange[1],
        flipHorizontal: flipH,
        flipVertical: flipV,
        rotationDeg: rotation,
        onProgress: (pct, message) => {
          setProgress(pct)
          setStatus(message)
        },
      }
      const out = hasEdits ? await processHelpTutorialVideo(sourceFile, opts) : sourceFile
      await onConfirm(out)
      onOpenChange(false)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Erro ao processar vídeo")
    } finally {
      setProcessing(false)
    }
  }

  const trimMax = Math.max(duration, 0.1)
  const trimStep = duration > 120 ? 1 : 0.1

  return (
    <Dialog open={open} onOpenChange={(v) => !processing && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-[#F5EDD6]" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
            Editar vídeo
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Ajuste corte, espelhamento ou rotação. A prévia mostra na hora; ao publicar, as edições são
            aplicadas ao arquivo.
          </DialogDescription>
        </DialogHeader>

        {sourceFile ? (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-zinc-800">
              {objectUrl ? (
                <video
                  ref={videoRef}
                  src={objectUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                  style={{ transform: previewTransform }}
                  onLoadedMetadata={onVideoMetadata}
                  onTimeUpdate={enforceTrimPreview}
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <Scissors className="w-3.5 h-3.5" />
                Corte
              </div>
              <Slider
                min={0}
                max={trimMax}
                step={trimStep}
                value={trimRange}
                disabled={!duration || processing}
                onValueChange={(v) => {
                  const [a, b] = v as [number, number]
                  setTrimRange([a, Math.max(a + 0.5, b)])
                }}
              />
              <p className="text-xs text-zinc-400 tabular-nums">
                Início {formatVideoTime(trimRange[0])} — Fim {formatVideoTime(trimRange[1])}
                {duration > 0 ? ` (duração ${formatVideoTime(trimRange[1] - trimRange[0])})` : null}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={flipH ? "default" : "outline"}
                className={flipH ? "bg-[#E8C872] text-black hover:bg-[#FFE08A]" : "border-zinc-700 text-zinc-300"}
                disabled={processing}
                onClick={() => setFlipH((v) => !v)}
              >
                <FlipHorizontal2 className="w-4 h-4 mr-1.5" />
                Espelhar horizontal
              </Button>
              <Button
                type="button"
                size="sm"
                variant={flipV ? "default" : "outline"}
                className={flipV ? "bg-[#E8C872] text-black hover:bg-[#FFE08A]" : "border-zinc-700 text-zinc-300"}
                disabled={processing}
                onClick={() => setFlipV((v) => !v)}
              >
                <FlipVertical2 className="w-4 h-4 mr-1.5" />
                Espelhar vertical
              </Button>
              <Button
                type="button"
                size="sm"
                variant={rotation ? "default" : "outline"}
                className={rotation ? "bg-[#E8C872] text-black hover:bg-[#FFE08A]" : "border-zinc-700 text-zinc-300"}
                disabled={processing}
                onClick={cycleRotation}
              >
                <RotateCw className="w-4 h-4 mr-1.5" />
                Girar {rotation ? `${rotation}°` : "90°"}
              </Button>
            </div>

            {processing ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{status || "Processando…"}</span>
                  {progress > 0 ? <span className="ml-auto tabular-nums text-zinc-500">{progress}%</span> : null}
                </div>
              </div>
            ) : status ? (
              <p className="text-sm text-red-400">{status}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 text-zinc-300"
            disabled={processing}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#E8C872] text-black hover:bg-[#FFE08A]"
            disabled={!sourceFile || processing || duration <= 0}
            onClick={() => void handleApply()}
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando…
              </>
            ) : hasEdits ? (
              "Aplicar edições e enviar"
            ) : (
              "Enviar sem editar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
