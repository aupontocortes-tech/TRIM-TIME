import {
  HELP_TUTORIAL_VIDEO_BUCKET,
  HELP_TUTORIAL_VIDEO_MAX_BYTES,
} from "@/lib/help-tutorial-video-constants"
import { createServiceRoleClient } from "@/lib/supabase/server"

export { HELP_TUTORIAL_VIDEO_BUCKET, HELP_TUTORIAL_VIDEO_MAX_BYTES }

type EnsureResult =
  | { ok: true; supabase: ReturnType<typeof createServiceRoleClient> }
  | { ok: false; error: string; hint?: string }

export async function ensureHelpTutorialVideoBucket(): Promise<EnsureResult> {
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

  const { error: bucketErr } = await supabase.storage.createBucket(HELP_TUTORIAL_VIDEO_BUCKET, {
    public: true,
    fileSizeLimit: HELP_TUTORIAL_VIDEO_MAX_BYTES,
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
      'Crie o bucket público "help-tutorial-videos" no Supabase ou rode supabase/migrations/036_help_tutorial_videos_storage_bucket.sql.',
  }
}

export function sanitizeHelpTutorialFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "video.mp4"
  const clean = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
  return clean || "video.mp4"
}

export function isAllowedHelpTutorialVideoNameAndType(fileName: string, mime: string): boolean {
  const lower = fileName.toLowerCase()
  const ext = lower.includes(".") ? (lower.split(".").pop() ?? "") : ""
  const allowedExt = new Set(["mp4", "webm", "mov"])
  if (mime.startsWith("video/")) return true
  return allowedExt.has(ext)
}
