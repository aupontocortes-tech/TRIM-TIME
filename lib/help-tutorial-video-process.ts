import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

export type HelpTutorialVideoEditOptions = {
  trimStartSec: number
  trimEndSec: number
  flipHorizontal: boolean
  flipVertical: boolean
  rotationDeg: 0 | 90 | 180 | 270
  onProgress?: (pct: number, message: string) => void
}

const FFMPEG_CORE_VERSION = "0.12.10"
const FFMPEG_CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`

let ffmpegSingleton: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

async function loadFfmpeg(onProgress?: HelpTutorialVideoEditOptions["onProgress"]): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton
  if (ffmpegLoading) return ffmpegLoading

  ffmpegLoading = (async () => {
    onProgress?.(0, "Carregando editor de vídeo…")
    const ffmpeg = new FFmpeg()
    ffmpeg.on("progress", ({ progress }) => {
      onProgress?.(Math.min(99, Math.round(progress * 100)), "Aplicando edições…")
    })
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    })
    ffmpegSingleton = ffmpeg
    return ffmpeg
  })()

  try {
    return await ffmpegLoading
  } finally {
    ffmpegLoading = null
  }
}

function buildVideoFilters(opts: HelpTutorialVideoEditOptions): string | null {
  const filters: string[] = []
  if (opts.rotationDeg === 90) filters.push("transpose=1")
  else if (opts.rotationDeg === 180) filters.push("transpose=2")
  else if (opts.rotationDeg === 270) filters.push("transpose=3")
  if (opts.flipHorizontal) filters.push("hflip")
  if (opts.flipVertical) filters.push("vflip")
  return filters.length ? filters.join(",") : null
}

export function formatVideoTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00"
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/** Aplica corte, espelhamento e rotação; devolve .mp4 pronto para upload. */
export async function processHelpTutorialVideo(
  file: File,
  opts: HelpTutorialVideoEditOptions
): Promise<File> {
  const start = Math.max(0, opts.trimStartSec)
  const end = Math.max(start + 0.5, opts.trimEndSec)

  const ffmpeg = await loadFfmpeg(opts.onProgress)
  opts.onProgress?.(5, "Preparando arquivo…")

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "mp4"
  const inputName = `input.${ext}`
  await ffmpeg.writeFile(inputName, await fetchFile(file))

  const args = [
    "-ss",
    start.toFixed(3),
    "-to",
    end.toFixed(3),
    "-i",
    inputName,
  ]

  const vf = buildVideoFilters(opts)
  if (vf) args.push("-vf", vf)

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "output.mp4"
  )

  opts.onProgress?.(10, "Processando vídeo…")
  try {
    await ffmpeg.exec(args)
  } catch {
    const noAudio = args.filter((a, i, arr) => {
      if (a === "-c:a") return false
      if (i > 0 && arr[i - 1] === "-c:a") return false
      if (a === "-b:a") return false
      if (i > 0 && arr[i - 1] === "-b:a") return false
      return true
    })
    noAudio.push("-an")
    await ffmpeg.exec(noAudio)
  }

  const data = await ffmpeg.readFile("output.mp4")
  await ffmpeg.deleteFile(inputName).catch(() => undefined)
  await ffmpeg.deleteFile("output.mp4").catch(() => undefined)

  const bytes = data instanceof Uint8Array ? data : new Uint8Array()
  const blob = new Blob([bytes], { type: "video/mp4" })
  const baseName = file.name.replace(/\.[^.]+$/i, "") || "tutorial"
  opts.onProgress?.(100, "Pronto!")
  return new File([blob], `${baseName}-editado.mp4`, { type: "video/mp4" })
}
