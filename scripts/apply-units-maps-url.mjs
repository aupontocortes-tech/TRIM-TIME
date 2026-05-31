/**
 * Corrige produção: coluna maps_url em barbershop_units (migration 025).
 * Uso: node scripts/apply-units-maps-url.mjs
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
  await prisma.$executeRawUnsafe(
    `ALTER TABLE barbershop_units ADD COLUMN IF NOT EXISTS maps_url TEXT`
  )
  console.log("OK: coluna maps_url em barbershop_units")
} catch (e) {
  console.error("Erro:", e instanceof Error ? e.message : e)
  process.exit(1)
}

await prisma.$disconnect()
