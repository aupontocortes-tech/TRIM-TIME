/**
 * Gera app/icon.png, public/icon.png e app/apple-icon.png a partir de public/trim-time-icon-source.png
 * Mantém proporção (fit: contain) com fundo #000.
 */
import sharp from "sharp"
import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const src = path.join(root, "public", "trim-time-icon-source.png")
const bg = { r: 0, g: 0, b: 0, alpha: 1 }

async function main() {
  await sharp(src)
    .resize(512, 512, { fit: "contain", background: bg })
    .png()
    .toFile(path.join(root, "public", "icon.png"))

  await sharp(src)
    .resize(512, 512, { fit: "contain", background: bg })
    .png()
    .toFile(path.join(root, "app", "icon.png"))

  await sharp(src)
    .resize(180, 180, { fit: "contain", background: bg })
    .png()
    .toFile(path.join(root, "app", "apple-icon.png"))

  console.log("OK: public/icon.png, app/icon.png, app/apple-icon.png")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
