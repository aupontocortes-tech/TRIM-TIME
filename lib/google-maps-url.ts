/**
 * Normaliza URL do Google Maps (ou link curto) para uso em links externos.
 */
export function normalizeGoogleMapsUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim()
  if (!raw) return null
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const url = new URL(withProto)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

export function resolveUnitMapsUrl(
  unit: { maps_url?: string | null },
  shopMapsUrl?: string | null
): string | null {
  return normalizeGoogleMapsUrl(unit.maps_url) ?? normalizeGoogleMapsUrl(shopMapsUrl) ?? null
}
