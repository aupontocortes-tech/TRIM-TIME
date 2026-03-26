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
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {
      // bucket já pode existir
    })

    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "mp3"
    const path = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "audio/mpeg",
      upsert: false,
    })
    if (up.error) {
      return NextResponse.json({ error: up.error.message }, { status: 500 })
    }

    const pub = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ ok: true, file_url: pub.data.publicUrl, file_name: file.name, path })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 })
  }
}
