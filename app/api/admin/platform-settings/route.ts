import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import {
  getPlatformSettings,
  normalizeWhatsappPhoneDigits,
  platformSettingsToApi,
  whatsappDigitsForWaMe,
} from "@/lib/platform-settings"
import { parsePlanPriceInput } from "@/lib/plan-prices"
import { prisma } from "@/lib/prisma"
function parseWhatsappField(body: { landing_whatsapp_phone?: string }) {
  const raw = String(body.landing_whatsapp_phone ?? "").trim()
  if (!raw) return { ok: true as const, value: null }
  const digits = normalizeWhatsappPhoneDigits(raw)
  if (!whatsappDigitsForWaMe(digits)) {
    return {
      ok: false as const,
      error: "Informe um WhatsApp válido com DDD (ex.: 11 99999-9999).",
    }
  }
  return { ok: true as const, value: digits }
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response
  try {
    const row = await getPlatformSettings()
    return NextResponse.json(platformSettingsToApi(row))
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
      price_basic?: number | string
      price_pro?: number | string
      price_premium?: number | string
      payment_api_enabled?: boolean
    }

    const existing = await getPlatformSettings()
    const update: {
      landingWhatsappPhone?: string | null
      priceBasic?: number | null
      pricePro?: number | null
      pricePremium?: number | null
      paymentApiEnabled?: boolean
    } = {}

    if ("landing_whatsapp_phone" in body) {
      const w = parseWhatsappField(body)
      if (!w.ok) return NextResponse.json({ error: w.error }, { status: 400 })
      update.landingWhatsappPhone = w.value
    }

    if ("price_basic" in body) {
      const parsed =
        body.price_basic === null || body.price_basic === ""
          ? null
          : parsePlanPriceInput(body.price_basic)
      if (body.price_basic !== null && body.price_basic !== "" && parsed == null) {
        return NextResponse.json({ error: "Valor inválido para o plano Básico." }, { status: 400 })
      }
      update.priceBasic = parsed
    }
    if ("price_pro" in body) {
      const parsed =
        body.price_pro === null || body.price_pro === ""
          ? null
          : parsePlanPriceInput(body.price_pro)
      if (body.price_pro !== null && body.price_pro !== "" && parsed == null) {
        return NextResponse.json({ error: "Valor inválido para o plano Pro." }, { status: 400 })
      }
      update.pricePro = parsed
    }
    if ("price_premium" in body) {
      const parsed =
        body.price_premium === null || body.price_premium === ""
          ? null
          : parsePlanPriceInput(body.price_premium)
      if (body.price_premium !== null && body.price_premium !== "" && parsed == null) {
        return NextResponse.json({ error: "Valor inválido para o plano Premium." }, { status: 400 })
      }
      update.pricePremium = parsed
    }

    if (typeof body.payment_api_enabled === "boolean") {
      update.paymentApiEnabled = body.payment_api_enabled
    }

    const row = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        landingWhatsappPhone: update.landingWhatsappPhone ?? existing.landingWhatsappPhone,
        priceBasic: update.priceBasic ?? existing.priceBasic,
        pricePro: update.pricePro ?? existing.pricePro,
        pricePremium: update.pricePremium ?? existing.pricePremium,
        paymentApiEnabled: update.paymentApiEnabled ?? existing.paymentApiEnabled,
      },
      update,
    })

    return NextResponse.json({ ok: true, ...platformSettingsToApi(row) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar" },
      { status: 500 }
    )
  }
}
