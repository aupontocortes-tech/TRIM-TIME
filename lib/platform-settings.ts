import { prisma } from "@/lib/prisma"

const SINGLETON_ID = "singleton"

export function normalizeWhatsappPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "")
}

/** Dígitos com DDI 55 para wa.me (Brasil). */
export function whatsappDigitsForWaMe(raw: string): string | null {
  const d = normalizeWhatsappPhoneDigits(raw)
  if (d.length < 10) return null
  if (d.startsWith("55") && d.length >= 12) return d
  if (d.length === 10 || d.length === 11) return `55${d}`
  if (d.length >= 12) return d
  return null
}

export function buildLandingWhatsappUrl(phoneDigits: string): string {
  const d = whatsappDigitsForWaMe(phoneDigits)
  if (!d) return ""
  const text = encodeURIComponent("Olá! Tenho dúvidas sobre o Trim Time.")
  return `https://wa.me/${d}?text=${text}`
}

export async function getPlatformSettings() {
  const row = await prisma.platformSettings.findUnique({
    where: { id: SINGLETON_ID },
  })
  if (row) return row
  return prisma.platformSettings.create({
    data: { id: SINGLETON_ID },
  })
}

export function landingWhatsappPhoneFromEnv(): string | null {
  const p = process.env.LANDING_WHATSAPP_PHONE?.trim()
  return p || null
}

export async function getLandingWhatsappPhone(): Promise<string | null> {
  try {
    const row = await getPlatformSettings()
    const fromDb = row.landingWhatsappPhone?.trim()
    if (fromDb) return fromDb
  } catch (e) {
    console.error("[platform-settings] getLandingWhatsappPhone", e)
  }
  return landingWhatsappPhoneFromEnv()
}

export async function resolveLandingWhatsappUrl(): Promise<string | null> {
  const phone = await getLandingWhatsappPhone()
  if (!phone) return null
  const url = buildLandingWhatsappUrl(phone)
  return url || null
}
