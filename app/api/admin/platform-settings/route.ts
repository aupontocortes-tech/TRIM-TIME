import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import {
  getPlatformSettings,
  normalizeWhatsappPhoneDigits,
  whatsappDigitsForWaMe,
} from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const row = await getPlatformSettings()
    return NextResponse.json({
      landing_whatsapp_phone: row.landingWhatsappPhone ?? "",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const body = (await request.json().catch(() => ({}))) as {
      landing_whatsapp_phone?: string
    }
    const raw = String(body.landing_whatsapp_phone ?? "").trim()
    let stored: string | null = null
    if (raw) {
      const digits = normalizeWhatsappPhoneDigits(raw)
      if (!whatsappDigitsForWaMe(digits)) {
        return NextResponse.json(
          { error: "Informe um WhatsApp válido com DDD (ex.: 11 99999-9999)." },
          { status: 400 }
        )
      }
      stored = digits
    }
    const row = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", landingWhatsappPhone: stored },
      update: { landingWhatsappPhone: stored },
    })
    return NextResponse.json({
      ok: true,
      landing_whatsapp_phone: row.landingWhatsappPhone ?? "",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar" },
      { status: 500 }
    )
  }
}
