/**
 * Gera ícones PWA a partir de public/trim-time-icon-source.png
 *
 * - Coloca o desenho menor no centro do quadrado (#000) para não “estourar”
 *   na tela inicial do Android (maskable / adaptive icon).
 * - purpose "maskable": ainda mais margem (zona segura do launcher).
 */
import sharp from "sharp"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const src = path.join(root, "public", "trim-time-icon-source.png")
const bg = { r: 0, g: 0, b: 0, alpha: 1 }

/** Tamanho do logo em relação ao lado do quadrado (resto = margem). */
const SCALE_ANY = 0.54
/** Maskable: logo menor — Android recorta as bordas; assim o símbolo fica visualmente menor. */
const SCALE_MASKABLE = 0.44

/**
 * @param {number} canvasSize
 * @param {number} innerScale
 * @param {string} outPath
 */
async function writeSquareIcon(canvasSize, innerScale, outPath) {
  const inner = Math.max(1, Math.round(canvasSize * innerScale))
  const resized = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: bg })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(outPath)
}

async function main() {
  await writeSquareIcon(512, SCALE_ANY, path.join(root, "public", "icon.png"))
  await writeSquareIcon(512, SCALE_ANY, path.join(root, "app", "icon.png"))
  await writeSquareIcon(
    512,
    SCALE_MASKABLE,
    path.join(root, "public", "icon-maskable-512.png")
  )
  await writeSquareIcon(192, SCALE_ANY, path.join(root, "public", "icon-192.png"))
  await writeSquareIcon(180, SCALE_ANY, path.join(root, "app", "apple-icon.png"))

  console.log(
    "OK: public/icon.png, public/icon-192.png, public/icon-maskable-512.png, app/icon.png, app/apple-icon.png"
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
