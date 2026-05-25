/**
 * Liga API de pagamento em platform_settings (equivalente ao switch no Super Admin).
 * Uso: node scripts/enable-payment-api.mjs
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
  console.error("DATABASE_URL ausente")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const row = await prisma.platformSettings.upsert({
  where: { id: "singleton" },
  create: { id: "singleton", paymentApiEnabled: true },
  update: { paymentApiEnabled: true },
})

console.log("payment_api_enabled:", row.paymentApiEnabled)
await prisma.$disconnect()
