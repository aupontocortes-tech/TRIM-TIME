import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { HELP_TUTORIAL_VIDEO_MAX_BYTES } from "@/lib/help-tutorial-video-constants"
import {
  ensureHelpTutorialVideoBucket,
  HELP_TUTORIAL_VIDEO_BUCKET,
  isAllowedHelpTutorialVideoNameAndType,
  sanitizeHelpTutorialFileName,
} from "@/lib/supabase/help-tutorial-video-bucket"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      file_name?: string
      content_type?: string
      size?: number
    }

    const safeName = sanitizeHelpTutorialFileName(String(body.file_name ?? "video.mp4"))
    const contentType = String(body.content_type ?? "video/mp4").trim() || "video/mp4"
    const size = Number(body.size ?? 0)
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Tamanho do arquivo inválido" }, { status: 400 })
    }
    if (size > HELP_TUTORIAL_VIDEO_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande (máx. ${Math.round(HELP_TUTORIAL_VIDEO_MAX_BYTES / (1024 * 1024))} MB por vídeo)`,
        },
        { status: 400 }
      )
    }
    if (!isAllowedHelpTutorialVideoNameAndType(safeName, contentType)) {
      return NextResponse.json({ error: "Envie um vídeo .mp4, .webm ou .mov" }, { status: 400 })
    }

    const ensured = await ensureHelpTutorialVideoBucket()
    if (!ensured.ok) {
      return NextResponse.json(
        { error: ensured.error, ...(ensured.hint ? { hint: ensured.hint } : {}) },
        { status: 500 }
      )
    }
    const { supabase } = ensured

    const ext = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "mp4"
    const objectPath = `tutorials/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { data, error } = await supabase.storage
      .from(HELP_TUTORIAL_VIDEO_BUCKET)
      .createSignedUploadUrl(objectPath)
    if (error || !data?.token || !data.path) {
      return NextResponse.json(
        {
          error: error?.message ?? "Não foi possível preparar o upload",
          hint: 'Confirme o bucket "help-tutorial-videos" e a chave service_role no Supabase.',
        },
        { status: 500 }
      )
    }

    const pub = supabase.storage.from(HELP_TUTORIAL_VIDEO_BUCKET).getPublicUrl(objectPath)
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
