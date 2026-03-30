/**
 * Áudio do Trim Play (Howler.js).
 * Por padrão usa WAV sintetizado em memória (sem arquivos).
 * Para trocar por .mp3/.wav: coloque em public/sounds/trim-play/
 *   place.mp3, line-clear.mp3, combo.mp3, game-over.mp3
 * e defina TRIMPLAY_USE_FILE_SOUNDS = true abaixo.
 */
import { Howl, Howler } from "howler"

const SAMPLE_RATE = 22050
const TRIMPLAY_USE_FILE_SOUNDS = false
const REMOTE_CONFIG_TTL_MS = 15000

const FILE_BASE = "/sounds/trim-play"
type RemoteCategory = "combo1" | "combo2" | "combo3" | "combo4" | "combo5" | "gameover" | "victory"
type RemoteAudioAsset = {
  id: string
  file: string
  name: string
  start: number
  end: number
  volume: number
}

let muted = false
try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("trimplay_muted") === "1"
} catch {
  muted = false
}

export function getTrimPlayMuted() {
  return muted
}

export function setTrimPlayMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem("trimplay_muted", value ? "1" : "0")
  } catch {
    /* ignore */
  }
}

function pcm16ToWav(samples: Int16Array): ArrayBuffer {
  const n = samples.length
  const buffer = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buffer)
  let o = 0
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o++, s.charCodeAt(i))
  }
  writeStr("RIFF")
  v.setUint32(o, 36 + n * 2, true)
  o += 4
  writeStr("WAVE")
  writeStr("fmt ")
  v.setUint32(o, 16, true)
  o += 4
  v.setUint16(o, 1, true)
  o += 2
  v.setUint16(o, 1, true)
  o += 2
  v.setUint32(o, SAMPLE_RATE, true)
  o += 4
  v.setUint32(o, SAMPLE_RATE * 2, true)
  o += 4
  v.setUint16(o, 2, true)
  o += 2
  v.setUint16(o, 16, true)
  o += 2
  writeStr("data")
  v.setUint32(o, n * 2, true)
  o += 4
  for (let i = 0; i < n; i++) {
    v.setInt16(o, samples[i]!, true)
    o += 2
  }
  return buffer
}

function genPlacePop(): Int16Array {
  const dur = 0.055
  const len = Math.floor(SAMPLE_RATE * dur)
  const out = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * 90)
    const f0 = 1350 - t * 18000
    const s = Math.sin(2 * Math.PI * Math.max(120, f0) * t) * env * 0.42
    out[i] = Math.round(s * 32000)
  }
  return out
}

function genLineWhoosh(): Int16Array {
  const dur = 0.32
  const len = Math.floor(SAMPLE_RATE * dur)
  const out = new Int16Array(len)
  let noiseState = 0.1337
  for (let i = 0; i < len; i++) {
    const t = i / len
    const env = Math.sin(Math.PI * t) * Math.exp(-t * 2.2)
    noiseState = (noiseState * 9301 + 49297) % 233280
    const n = noiseState / 233280 - 0.5
    const sweep = Math.sin(2 * Math.PI * (180 + t * 1400) * (i / SAMPLE_RATE)) * 0.35
    const s = (n * 0.55 + sweep) * env * 0.85
    out[i] = Math.round(Math.max(-1, Math.min(1, s)) * 30000)
  }
  return out
}

/** Combo: sequência de tons ascendentes (intensidade 1–5) */
function genCombo(level: number): Int16Array {
  const steps = Math.min(5, Math.max(2, level))
  const beep = 0.07
  const gap = 0.028
  const dur = steps * (beep + gap) + 0.05
  const len = Math.floor(SAMPLE_RATE * dur)
  const out = new Int16Array(len)
  const freqs = [420, 560, 720, 900, 1100, 1280]
  for (let k = 0; k < steps; k++) {
    const start = Math.floor(SAMPLE_RATE * k * (beep + gap))
    const f = freqs[k]! * (1 + level * 0.04)
    for (let i = 0; i < Math.floor(SAMPLE_RATE * beep); i++) {
      const j = start + i
      if (j >= len) break
      const t = i / SAMPLE_RATE
      const env = Math.sin(Math.PI * (i / (SAMPLE_RATE * beep))) * (0.35 + k * 0.06)
      const s = Math.sin(2 * Math.PI * f * t) * env
      out[j] = Math.round(s * 28000)
    }
  }
  return out
}

function genGameOver(): Int16Array {
  const dur = 0.95
  const len = Math.floor(SAMPLE_RATE * dur)
  const out = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE
    const f = 195 * Math.exp(-t * 1.35) + 55
    const env = Math.exp(-t * 1.1) * (1 - t * 0.15)
    const s = Math.sin(2 * Math.PI * f * t) * 0.55 * env
    out[i] += Math.round(s * 26000)
    const s2 = Math.sin(2 * Math.PI * (f * 0.5) * t + 1.2) * 0.12 * env
    out[i] += Math.round(s2 * 26000)
  }
  return out
}

/** Vitória (tabuleiro limpo): fanfarra curta em Howl separado — não mexe no howl do combo. */
function genVictoryFanfare(): Int16Array {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  const noteDur = 0.1
  const gap = 0.04
  const tail = 0.35
  const dur = notes.length * (noteDur + gap) + tail
  const len = Math.floor(SAMPLE_RATE * dur)
  const out = new Int16Array(len)
  for (let n = 0; n < notes.length; n++) {
    const f = notes[n]!
    const start = Math.floor(SAMPLE_RATE * n * (noteDur + gap))
    const noteLen = Math.floor(SAMPLE_RATE * noteDur)
    for (let i = 0; i < noteLen; i++) {
      const j = start + i
      if (j >= len) break
      const t = i / SAMPLE_RATE
      const env = Math.sin(Math.PI * (i / noteLen)) * (0.38 + n * 0.05)
      const s = Math.sin(2 * Math.PI * f * t) * env
      let acc = s
      acc += Math.sin(2 * Math.PI * f * 2 * t) * env * 0.22
      out[j] += Math.round(acc * 24000)
    }
  }
  const chordStart = Math.floor(SAMPLE_RATE * (notes.length * (noteDur + gap) + 0.02))
  const chordLen = Math.floor(SAMPLE_RATE * tail)
  for (let i = 0; i < chordLen; i++) {
    const j = chordStart + i
    if (j >= len) break
    const t = i / SAMPLE_RATE
    const env = Math.sin((Math.PI * i) / chordLen) * Math.exp(-t * 2.4)
    let s = 0
    for (const f of [523.25, 659.25, 783.99]) {
      s += Math.sin(2 * Math.PI * f * t) * 0.2
    }
    out[j] += Math.round(s * env * 28000)
  }
  return out
}

function makeHowlFromPcm(gen: () => Int16Array, volume: number): Howl {
  const url = URL.createObjectURL(new Blob([pcm16ToWav(gen())], { type: "audio/wav" }))
  return new Howl({
    src: [url],
    format: ["wav"],
    volume,
    preload: true,
    html5: false,
  })
}

function makeHowlFromFile(name: string, volume: number): Howl {
  return new Howl({
    src: [`${FILE_BASE}/${name}.mp3`, `${FILE_BASE}/${name}.wav`],
    volume,
    preload: true,
    html5: true,
  })
}

let placeHowl: Howl | null = null
let lineHowl: Howl | null = null
let fileComboHowl: Howl | null = null
let proceduralComboHowl: Howl | null = null
let victoryHowl: Howl | null = null
let gameOverHowl: Howl | null = null
let unlocked = false
let remoteCategories: Record<RemoteCategory, RemoteAudioAsset[]> = {
  combo1: [],
  combo2: [],
  combo3: [],
  combo4: [],
  combo5: [],
  gameover: [],
  victory: [],
}
const remoteNextIndex: Record<RemoteCategory, number> = {
  combo1: 0,
  combo2: 0,
  combo3: 0,
  combo4: 0,
  combo5: 0,
  gameover: 0,
  victory: 0,
}
const remoteLastRandomIndex: Partial<Record<RemoteCategory, number>> = {}
let remoteCfgLoadedAt = 0
const remoteHowls = new Map<string, Howl>()

function configSig(x: RemoteAudioAsset) {
  return [x.id, x.file, x.start, x.end, x.volume].join("|")
}

async function loadRemoteAudioConfig() {
  const now = Date.now()
  if (now - remoteCfgLoadedAt < REMOTE_CONFIG_TTL_MS) return
  remoteCfgLoadedAt = now
  try {
    const res = await fetch("/api/trimplay/audio-config", { credentials: "include" })
    if (!res.ok) return
    const data = (await res.json().catch(() => ({}))) as {
      categories?: Partial<Record<RemoteCategory, RemoteAudioAsset[]>>
    }
    remoteCategories = {
      combo1: Array.isArray(data.categories?.combo1) ? data.categories!.combo1! : [],
      combo2: Array.isArray(data.categories?.combo2) ? data.categories!.combo2! : [],
      combo3: Array.isArray(data.categories?.combo3) ? data.categories!.combo3! : [],
      combo4: Array.isArray(data.categories?.combo4) ? data.categories!.combo4! : [],
      combo5: Array.isArray(data.categories?.combo5) ? data.categories!.combo5! : [],
      gameover: Array.isArray(data.categories?.gameover) ? data.categories!.gameover! : [],
      victory: Array.isArray(data.categories?.victory) ? data.categories!.victory! : [],
    }
  } catch {
    // fallback para áudio procedural/file local
  }
}

async function loadRemoteAudioAssets() {
  const now = Date.now()
  if (now - remoteCfgLoadedAt < REMOTE_CONFIG_TTL_MS) return
  remoteCfgLoadedAt = now
  try {
    const res = await fetch("/api/trimplay/audio-assets", { credentials: "include" })
    if (!res.ok) return
    const data = (await res.json().catch(() => ({}))) as {
      categories?: Partial<Record<RemoteCategory, RemoteAudioAsset[]>>
    }
    remoteCategories = {
      combo1: Array.isArray(data.categories?.combo1) ? data.categories!.combo1! : [],
      combo2: Array.isArray(data.categories?.combo2) ? data.categories!.combo2! : [],
      combo3: Array.isArray(data.categories?.combo3) ? data.categories!.combo3! : [],
      combo4: Array.isArray(data.categories?.combo4) ? data.categories!.combo4! : [],
      combo5: Array.isArray(data.categories?.combo5) ? data.categories!.combo5! : [],
      gameover: Array.isArray(data.categories?.gameover) ? data.categories!.gameover! : [],
      victory: Array.isArray(data.categories?.victory) ? data.categories!.victory! : [],
    }
  } catch {
    // fallback para áudio procedural/file local
  }
}

function tryPlayRemote(category: RemoteCategory): boolean {
  const assets = remoteCategories[category] ?? []
  if (assets.length === 0) return false
  let idx = remoteNextIndex[category] % assets.length
  if (category === "gameover") {
    if (assets.length === 1) {
      idx = 0
    } else {
      const prev = remoteLastRandomIndex.gameover
      let next = Math.floor(Math.random() * assets.length)
      if (prev !== undefined && next === prev) {
        next = (next + 1 + Math.floor(Math.random() * (assets.length - 1))) % assets.length
      }
      idx = next
      remoteLastRandomIndex.gameover = idx
    }
  }
  const cfg = assets[idx]!
  remoteNextIndex[category] = (idx + 1) % assets.length

  const sig = configSig(cfg)
  let howl = remoteHowls.get(sig)
  if (!howl) {
    const start = Math.max(0, Math.floor((cfg.start || 0) * 1000))
    const end = Math.max(0, Math.floor((cfg.end || 0) * 1000))
    const hasTrim = end > start
    howl = new Howl({
      src: [cfg.file],
      html5: true,
      preload: true,
      volume: Math.max(0, Math.min(1.5, cfg.volume || 1)),
      ...(hasTrim ? { sprite: { clip: [start, end - start] as [number, number] } } : {}),
    } as ConstructorParameters<typeof Howl>[0])
    remoteHowls.set(sig, howl)
  }
  try {
    const hasTrim = Math.max(0, cfg.end || 0) > Math.max(0, cfg.start || 0)
    if (hasTrim) void (howl as Howl & { play(id?: string): number }).play("clip")
    else howl.play()
    return true
  } catch {
    return false
  }
}

function ensureHowls() {
  if (placeHowl) return
  victoryHowl = makeHowlFromPcm(genVictoryFanfare, 0.5)
  if (TRIMPLAY_USE_FILE_SOUNDS) {
    placeHowl = makeHowlFromFile("place", 0.4)
    lineHowl = makeHowlFromFile("line-clear", 0.5)
    fileComboHowl = makeHowlFromFile("combo", 0.55)
    gameOverHowl = makeHowlFromFile("game-over", 0.45)
    return
  }
  placeHowl = makeHowlFromPcm(genPlacePop, 0.38)
  lineHowl = makeHowlFromPcm(genLineWhoosh, 0.48)
  gameOverHowl = makeHowlFromPcm(genGameOver, 0.44)
}

/** Chame no primeiro gesto do usuário (pointerdown) para liberar áudio no mobile */
export function unlockTrimPlayAudio() {
  if (unlocked) return
  unlocked = true
  ensureHowls()
  void loadRemoteAudioAssets()
  try {
    const ctx = Howler.ctx as AudioContext | undefined
    if (ctx?.state === "suspended") void ctx.resume()
  } catch {
    /* ignore */
  }
}

function play(howl: Howl | null) {
  if (muted || !howl) return
  try {
    howl.stop()
    howl.play()
  } catch {
    /* ignore */
  }
}

export function playTrimPlayPlace() {
  ensureHowls()
  void loadRemoteAudioAssets()
  play(placeHowl)
}

export function playTrimPlayLineClear() {
  ensureHowls()
  void loadRemoteAudioAssets()
  play(lineHowl)
}

export function playTrimPlayCombo(level: number) {
  ensureHowls()
  if (muted) return
  const comboLevel = Math.min(5, Math.max(1, Math.floor(level || 1)))
  void loadRemoteAudioAssets()
  const comboKey: RemoteCategory =
    comboLevel >= 5
      ? "combo5"
      : comboLevel === 4
        ? "combo4"
        : comboLevel === 3
          ? "combo3"
          : comboLevel === 2
            ? "combo2"
            : "combo1"
  if (tryPlayRemote(comboKey)) return
  if (TRIMPLAY_USE_FILE_SOUNDS) {
    play(fileComboHowl)
    return
  }
  // Fallback procedural não possui versão dedicada para nível 1.
  // Para manter o "primeiro combo" audível, usamos a intensidade mínima procedural.
  const proceduralLevel = Math.max(2, comboLevel)
  proceduralComboHowl?.unload()
  proceduralComboHowl = makeHowlFromPcm(() => genCombo(proceduralLevel), 0.48 + comboLevel * 0.028)
  try {
    proceduralComboHowl.play()
  } catch {
    /* ignore */
  }
}

export function playTrimPlayGameOver() {
  ensureHowls()
  void loadRemoteAudioAssets()
  if (tryPlayRemote("gameover")) return
  play(gameOverHowl)
}

export function playTrimPlayVictory() {
  ensureHowls()
  void loadRemoteAudioAssets()
  if (tryPlayRemote("victory")) return
  play(victoryHowl)
}
