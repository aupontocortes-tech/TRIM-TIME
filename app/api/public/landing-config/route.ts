import { NextResponse } from "next/server"
import { getLandingWhatsappPhone, resolveLandingWhatsappUrl } from "@/lib/platform-settings"
import { TRIAL_DAYS } from "@/lib/plans"

export async function GET() {
  try {
    const phone = await getLandingWhatsappPhone()
    const whatsapp_url = await resolveLandingWhatsappUrl()
    return NextResponse.json({
      trial_days: TRIAL_DAYS,
      whatsapp_phone: phone,
      whatsapp_url: whatsapp_url || null,
    })
  } catch (e) {
    console.error("[public/landing-config]", e)
    return NextResponse.json(
      { trial_days: TRIAL_DAYS, whatsapp_phone: null, whatsapp_url: null },
      { status: 200 }
    )
  }
}
