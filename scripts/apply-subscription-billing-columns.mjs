/**
 * Aplica colunas de cobrança Asaas na tabela subscriptions (corrige erro na Minha assinatura).
 * Uso: node scripts/apply-subscription-billing-columns.mjs
 * Requer DATABASE_URL ou DIRECT_DATABASE_URL válida em .env.local (Supabase → Settings → Database).
 */
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const url = (process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "").trim()
if (!url) {
  console.error(
    "Configure DIRECT_DATABASE_URL ou DATABASE_URL em .env.local com a connection string do Supabase (modo Session ou Direct)."
  )
  console.error("Supabase → Project Settings → Database → Connection string")
  process.exit(1)
}

const sqlPath = path.join(root, "supabase/migrations/027_subscriptions_billing_columns.sql")
const sql = fs
  .readFileSync(sqlPath, "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .trim()

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

try {
  await prisma.$executeRawUnsafe(sql)
  console.log("OK: colunas de assinatura/cobrança aplicadas em subscriptions.")
  const cols = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name IN (
        'asaas_customer_id',
        'asaas_subscription_id',
        'billing_type',
        'card_setup_at',
        'post_trial_choice',
        'grace_access_until'
      )
    ORDER BY column_name
  `
  console.log(
    "Colunas presentes:",
    cols.map((r) => r.column_name).join(", ") || "(nenhuma — verifique o nome da tabela)"
  )
} catch (e) {
  console.error("Falha:", e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
