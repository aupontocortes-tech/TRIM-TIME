/** Limite de caracteres do data URL (fotos ~1024px em JPEG ~0,92). */
export const MAX_PROFILE_PHOTO_DATA_URL_CHARS = 650_000

const MAX_LEN = MAX_PROFILE_PHOTO_DATA_URL_CHARS

const ALLOWED_PREFIX = /^data:image\/(jpeg|jpg|png|webp);base64,/i

export function assertValidProfilePhotoDataUrl(
  value: string | null | undefined,
  label = "Foto"
): string | null {
  if (value == null || String(value).trim() === "") return null
  const s = String(value).trim()
  if (s.length > MAX_LEN) {
    throw new Error(`${label}: imagem muito grande. Use uma foto menor.`)
  }
  if (!ALLOWED_PREFIX.test(s)) {
    throw new Error(`${label}: envie uma imagem JPG, PNG ou WebP.`)
  }
  return s
}
