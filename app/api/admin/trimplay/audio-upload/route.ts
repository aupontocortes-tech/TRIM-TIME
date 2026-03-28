import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

const AUDIO_KEYS = new Set(["combo1", "combo2", "combo3", "combo4", "gameover", "victory"])
const BUCKET = "trimplay-audio"

function isAllowedAudioFile(file: File) {
  const name = file.name.toLowerCase()
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : ""
  const allowedExt = new Set(["mp3", "wav", "mpeg"])
  if (file.type.startsWith("audio/")) return true
  return allowedExt.has(ext)
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const form = await request.formData()
    const key = String(form.get("key") ?? form.get("category") ?? "")
      .trim()
      .toLowerCase()
      .replace("vitoria", "victory")
    const file = form.get("file")
    if (!AUDIO_KEYS.has(key)) {
      return NextResponse.json({ error: "key inválida" }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 })
    }
    if (!isAllowedAudioFile(file)) {
      return NextResponse.json({ error: "Envie um áudio .mp3, .wav ou .mpeg" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52_428_800,
    })
    if (bucketErr) {
      const raw = `${bucketErr.message ?? ""} ${(bucketErr as { statusCode?: string }).statusCode ?? ""}`
      const alreadyThere =
        /already exists|duplicate|BucketAlreadyExists|409/i.test(raw) ||
        (bucketErr as { statusCode?: string }).statusCode === "409"
      if (!alreadyThere) {
        return NextResponse.json(
          {
            error: `Supabase Storage: ${bucketErr.message}`,
            hint:
              'Crie o bucket público "trimplay-audio" no Supabase (Storage → New bucket) ou rode o SQL em supabase/migrations/012_trimplay_audio_storage_bucket.sql. Verifique SUPABASE_SERVICE_ROLE_KEY na Vercel.',
          },
          { status: 500 }
        )
      }
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "mp3"
    const path = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "audio/mpeg",
      upsert: false,
    })
    if (up.error) {
      let hint: string | undefined
      const em = up.error.message.toLowerCase()
      if (em.includes("mime") || em.includes("type") || em.includes("not allowed")) {
        hint =
          'No Supabase → Storage → bucket "trimplay-audio" → Configuration: deixe "Allowed MIME types" vazio (todos) ou inclua audio/mpeg, audio/wav.'
      } else if (em.includes("row-level security") || em.includes("rls") || em.includes("policy")) {
        hint =
          'Execute supabase/migrations/012_trimplay_audio_storage_bucket.sql no SQL Editor ou torne o bucket público e revise as políticas em Storage → Policies.'
      } else if (em.includes("bucket") && em.includes("not found")) {
        hint =
          'Crie o bucket "trimplay-audio" (público) no Supabase ou rode a migration 012_trimplay_audio_storage_bucket.sql.'
      }
      return NextResponse.json(
        { error: up.error.message, ...(hint ? { hint } : {}) },
        { status: 500 }
      )
    }

    const pub = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ ok: true, file_url: pub.data.publicUrl, file_name: file.name, path })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
