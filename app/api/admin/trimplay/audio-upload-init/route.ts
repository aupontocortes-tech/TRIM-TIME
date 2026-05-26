import { NextResponse } from "next/server"
import { TRIMPLAY_AUDIO_BUCKET, TRIMPLAY_AUDIO_MAX_BYTES } from "@/lib/trimplay-audio-constants"
import { requireSuperAdmin } from "@/lib/admin-auth"
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
    const body = (await request.json().catch(() => ({}))) as {
      category?: string
      file_name?: string
      content_type?: string
      size?: number
    }
    const key = String(body.category ?? "")
      .trim()
      .toLowerCase()
      .replace("vitoria", "victory")
    if (!AUDIO_KEYS.has(key)) {
      return NextResponse.json({ error: "Categoria inválida" }, { status: 400 })
    }

    const safeName = sanitizeTrimplayFileName(String(body.file_name ?? "audio.mp3"))
    const contentType = String(body.content_type ?? "audio/mpeg").trim() || "audio/mpeg"
    const size = Number(body.size ?? 0)
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Tamanho do arquivo inválido" }, { status: 400 })
    }
    if (size > TRIMPLAY_AUDIO_MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande (máx. ${Math.round(TRIMPLAY_AUDIO_MAX_BYTES / (1024 * 1024))} MB)` },
        { status: 400 }
      )
    }
    if (!isAllowedTrimplayAudioNameAndType(safeName, contentType)) {
      return NextResponse.json({ error: "Use áudio .mp3, .wav ou .mpeg" }, { status: 400 })
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
    const objectPath = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { data, error } = await supabase.storage.from(TRIMPLAY_AUDIO_BUCKET).createSignedUploadUrl(objectPath)
    if (error || !data?.token || !data.path) {
      return NextResponse.json(
        {
          error: error?.message ?? "Não foi possível criar URL de upload",
          hint: "Confirme o bucket trimplay-audio e a chave service_role no mesmo projeto Supabase.",
        },
        { status: 500 }
      )
    }

    const pub = supabase.storage.from(TRIMPLAY_AUDIO_BUCKET).getPublicUrl(objectPath)
    return NextResponse.json({
      ok: true,
      path: data.path,
      token: data.token,
      file_url: pub.data.publicUrl,
      file_name: safeName,
      content_type: contentType,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
