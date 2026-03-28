import { TRIMPLAY_AUDIO_BUCKET, TRIMPLAY_AUDIO_MAX_BYTES } from "@/lib/trimplay-audio-constants"
import { createServiceRoleClient } from "@/lib/supabase/server"

export { TRIMPLAY_AUDIO_BUCKET, TRIMPLAY_AUDIO_MAX_BYTES }

type EnsureResult =
  | { ok: true; supabase: ReturnType<typeof createServiceRoleClient> }
  | { ok: false; error: string; hint?: string }

export async function ensureTrimplayAudioBucket(): Promise<EnsureResult> {
  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Supabase não configurado",
      hint: "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel (Production).",
    }
  }

  const { error: bucketErr } = await supabase.storage.createBucket(TRIMPLAY_AUDIO_BUCKET, {
    public: true,
    fileSizeLimit: TRIMPLAY_AUDIO_MAX_BYTES,
  })
  if (!bucketErr) return { ok: true, supabase }

  const raw = `${bucketErr.message ?? ""} ${(bucketErr as { statusCode?: string }).statusCode ?? ""}`
  const alreadyThere =
    /already exists|duplicate|BucketAlreadyExists|409/i.test(raw) ||
    (bucketErr as { statusCode?: string }).statusCode === "409"
  if (alreadyThere) return { ok: true, supabase }

  return {
    ok: false,
    error: `Supabase Storage: ${bucketErr.message}`,
    hint:
      'Crie o bucket público "trimplay-audio" no Supabase ou rode supabase/migrations/012_trimplay_audio_storage_bucket.sql.',
  }
}

export function sanitizeTrimplayFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "audio.mp3"
  const clean = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
  return clean || "audio.mp3"
}

export function isAllowedTrimplayAudioNameAndType(fileName: string, mime: string): boolean {
  const lower = fileName.toLowerCase()
  const ext = lower.includes(".") ? lower.split(".").pop() ?? "" : ""
  const allowedExt = new Set(["mp3", "wav", "mpeg"])
  if (mime.startsWith("audio/")) return true
  return allowedExt.has(ext)
}
