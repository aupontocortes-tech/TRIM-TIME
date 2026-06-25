/**
 * Aplica coluna archived_by_user em barbershop_units.
 * Uso: node scripts/apply-units-archived-by-user-column.mjs
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"
import pg from "pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente em .env.local")
  process.exit(1)
}

const sql = readFileSync(
  path.join(root, "supabase/migrations/034_barbershop_units_archived_by_user.sql"),
  "utf8"
)

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(sql)
  console.log("OK: coluna archived_by_user aplicada em barbershop_units")
} finally {
  await client.end()
}
