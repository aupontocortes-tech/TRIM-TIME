/** Maior lado da imagem após redimensionar (boa nitidez em avatares retina / modais). */
export const PROFILE_PHOTO_MAX_EDGE = 1024

/** Qualidade JPEG para fotos de perfil (equilíbrio tamanho × detalhe). */
export const PROFILE_PHOTO_JPEG_QUALITY = 0.92

/**
 * Redimensiona pelo maior lado e exporta JPEG em data URL (apenas no browser).
 * Usa suavização de alta qualidade no canvas para downscale mais limpo.
 */
export function compressImageToJpegDataUrl(
  file: File,
  maxEdge: number = PROFILE_PHOTO_MAX_EDGE,
  quality: number = PROFILE_PHOTO_JPEG_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width
      let h = img.height
      const longest = Math.max(w, h)
      if (longest > maxEdge) {
        const scale = maxEdge / longest
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d", { alpha: false })
      if (!ctx) {
        reject(new Error("Não foi possível processar a imagem"))
        return
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Arquivo de imagem inválido"))
    }
    img.src = url
  })
}
