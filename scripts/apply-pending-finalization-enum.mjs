/**
 * Aplica enum pending_finalization no Postgres (Supabase).
 * Uso: node scripts/apply-pending-finalization-enum.mjs
 */
import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: ".env.local" })
dotenv.config()

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL ou DIRECT_DATABASE_URL não definido.")
  process.exit(1)
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
})

try {
  await client.connect()
  await client.query(`
    ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'pending_finalization';
  `)
  console.log("OK: enum pending_finalization aplicado.")
} catch (e) {
  console.error("Erro:", e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
