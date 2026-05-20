import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const tables = await prisma.$queryRaw`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE '%subscription%'
`
console.log("tables:", tables)

for (const name of ["subscriptions", "Subscription"]) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${name}
    ORDER BY column_name
  `
  console.log(`\n${name}:`, rows.map((r) => r.column_name).join(", ") || "(none)")
}
await prisma.$disconnect()
