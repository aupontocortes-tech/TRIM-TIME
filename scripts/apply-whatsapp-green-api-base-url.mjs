/**
 * Adiciona green_api_base_url em whatsapp_integrations (Green API).
 * Uso: node scripts/apply-whatsapp-green-api-base-url.mjs
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente em .env.local")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

try {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE whatsapp_integrations
      ADD COLUMN IF NOT EXISTS green_api_base_url TEXT
  `)
  console.log("OK: coluna green_api_base_url em whatsapp_integrations")
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
