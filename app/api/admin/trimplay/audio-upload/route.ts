import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { TRIMPLAY_AUDIO_BUCKET } from "@/lib/trimplay-audio-constants"
import {
  ensureTrimplayAudioBucket,
  isAllowedTrimplayAudioNameAndType,
  sanitizeTrimplayFileName,
} from "@/lib/supabase/trimplay-audio-bucket"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const AUDIO_KEYS = new Set(["combo1", "combo2", "combo3", "combo4", "combo5", "gameover", "victory"])

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const form = await request.formData()
    const key = String(form.get("key") ?? form.get("category") ?? "")
      .trim()
      .toLowerCase()
      .replace("vitoria", "victory")
    const raw = form.get("file")
    if (!AUDIO_KEYS.has(key)) {
      return NextResponse.json({ error: "key inválida" }, { status: 400 })
    }

    if (!(raw instanceof Blob) || raw.size === 0) {
      return NextResponse.json(
        { error: "Arquivo obrigatório (formato não reconhecido pelo servidor — use o upload pelo site atualizado)" },
        { status: 400 }
      )
    }

    const fallbackName = String(form.get("file_name") ?? "").trim() || "audio.mp3"
    const displayName = raw instanceof File && raw.name ? raw.name : fallbackName
    const safeName = sanitizeTrimplayFileName(displayName)
    const mime = raw.type || "application/octet-stream"
    if (!isAllowedTrimplayAudioNameAndType(safeName, mime)) {
      return NextResponse.json({ error: "Envie um áudio .mp3, .wav ou .mpeg" }, { status: 400 })
    }

    const ensured = await ensureTrimplayAudioBucket()
    if (!ensured.ok) {
      return NextResponse.json(
        { error: ensured.error, ...(ensured.hint ? { hint: ensured.hint } : {}) },
        { status: 500 }
      )
    }
    const { supabase } = ensured

    const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "mp3"
    const path = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const bytes = new Uint8Array(await raw.arrayBuffer())
    const up = await supabase.storage.from(TRIMPLAY_AUDIO_BUCKET).upload(path, bytes, {
      contentType: raw.type || "audio/mpeg",
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
          "Execute supabase/migrations/012_trimplay_audio_storage_bucket.sql no SQL Editor ou revise as políticas em Storage → Policies."
      } else if (em.includes("bucket") && em.includes("not found")) {
        hint =
          'Crie o bucket "trimplay-audio" (público) no Supabase ou rode a migration 012_trimplay_audio_storage_bucket.sql.'
      }
      return NextResponse.json(
        { error: up.error.message, ...(hint ? { hint } : {}) },
        { status: 500 }
      )
    }

    const pub = supabase.storage.from(TRIMPLAY_AUDIO_BUCKET).getPublicUrl(path)
    return NextResponse.json({ ok: true, file_url: pub.data.publicUrl, file_name: safeName, path })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
