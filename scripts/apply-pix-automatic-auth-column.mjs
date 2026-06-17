/**
 * Coluna asaas_pix_automatic_auth_id — Prisma usa tabela "Subscription" em produção.
 * Uso: node scripts/apply-pix-automatic-auth-column.mjs
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

const sql = `ADD COLUMN IF NOT EXISTS asaas_pix_automatic_auth_id TEXT`

for (const table of [`"Subscription"`, "subscriptions"]) {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ${sql}`)
    console.log(`OK: asaas_pix_automatic_auth_id em ${table}`)
  } catch (e) {
    console.warn(`${table}:`, e instanceof Error ? e.message : e)
  }
}

await prisma.$disconnect()
