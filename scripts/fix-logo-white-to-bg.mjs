/**
 * Troca pixels brancos / cinza-claro neutros (fundo do PNG) por preto do tema.
 * Não mexe em dourados (alto contraste entre R, G, B).
 *
 * Uso:
 *   node scripts/fix-logo-white-to-bg.mjs [entrada.png] [saida.png]
 * Padrão: public/icon.png → sobrescreve o mesmo ficheiro (com backup .bak opcional)
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

const inArg = process.argv[2] || path.join(root, "public", "icon.png")
const outArg = process.argv[3] || path.join(root, "public", "icon.png")

// ~ oklch(0.035 0 0) do tema Trim Time
const BG_R = 9
const BG_G = 9
const BG_B = 9

function shouldReplaceWhite(r, g, b, a) {
  if (a < 8) return false
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const chroma = mx - mn
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  // Branco / cinza muito claro (baixa saturação)
  if (chroma <= 32 && lum >= 228) return true
  // Quase branco puro
  if (lum >= 248 && chroma <= 40) return true
  // Halo claro em volta do dourado (anti-alias / fundo mal removido), sem tocar na pele (mais escura)
  if (chroma <= 44 && lum >= 218) return true
  return false
}

const inputPath = path.isAbsolute(inArg) ? inArg : path.join(root, inArg)
const outputPath = path.isAbsolute(outArg) ? outArg : path.join(root, outArg)

const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width, height, channels } = info
if (channels !== 4) {
  console.error("Esperado RGBA")
  process.exit(1)
}

const out = Buffer.from(data)
for (let i = 0; i < out.length; i += 4) {
  const r = out[i]
  const g = out[i + 1]
  const b = out[i + 2]
  const a = out[i + 3]
  if (shouldReplaceWhite(r, g, b, a)) {
    out[i] = BG_R
    out[i + 1] = BG_G
    out[i + 2] = BG_B
    out[i + 3] = 255
  }
}

await sharp(out, {
  raw: { width, height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toFile(outputPath + ".tmp")

fs.renameSync(outputPath + ".tmp", outputPath)
console.log("OK:", outputPath, `${width}x${height}`)
