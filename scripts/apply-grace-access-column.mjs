/**
 * Corrige cadastro em produção: coluna grace_access_until na assinatura.
 * Uso: node scripts/apply-grace-access-column.mjs
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
    `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS grace_access_until TIMESTAMPTZ`
  )
  console.log("OK: grace_access_until em Subscription")
} catch (e) {
  console.warn("Subscription:", e instanceof Error ? e.message : e)
}

try {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_access_until TIMESTAMPTZ`
  )
  console.log("OK: grace_access_until em subscriptions (se existir)")
} catch (e) {
  console.warn("subscriptions:", e instanceof Error ? e.message : e)
}

await prisma.$disconnect()
