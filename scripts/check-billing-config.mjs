/**
 * Verifica config de cobrança no banco (platform_settings) e variáveis locais.
 * A Vercel não é visível daqui — compare com Settings → Environment Variables.
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

const row = await prisma.platformSettings.findUnique({ where: { id: "singleton" } })

console.log("\n=== Banco (platform_settings) ===")
console.log("payment_api_enabled:", row?.paymentApiEnabled ?? "(sem linha)")

console.log("\n=== .env.local (só sua máquina — compare com Vercel Production) ===")
const keys = [
  "ASAAS_API_KEY",
  "ASAAS_ENVIRONMENT",
  "ASAAS_WEBHOOK_TOKEN",
  "PAYMENT_API_ENABLED",
  "RESEND_API_KEY",
  "OTP_EMAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]
for (const k of keys) {
  const v = process.env[k]?.trim()
  if (!v) {
    console.log(`${k}: (não definido)`)
    continue
  }
  if (k.includes("KEY") || k.includes("TOKEN") || k.includes("SECRET")) {
    console.log(`${k}: definido (${v.length} caracteres, começa com ${v.slice(0, 8)}…)`)
  } else {
    console.log(`${k}: ${v}`)
  }
}

console.log("\n=== Checklist Vercel (Production) ===")
console.log("Cobrança Asaas precisa de TODOS:")
console.log("  - ASAAS_API_KEY")
console.log("  - PAYMENT_API_ENABLED=true  (ou payment_api_enabled no /plataforma/configuracoes)")
console.log("  - ASAAS_ENVIRONMENT=sandbox (ou production)")
console.log("Opcional mas recomendado: ASAAS_WEBHOOK_TOKEN, NEXT_PUBLIC_APP_URL=https://trimtime.pro")
console.log("\nOTP e-mail (cadastro) precisa de:")
console.log("  - RESEND_API_KEY")
console.log("  - OTP_EMAIL_FROM=Trim Time <noreply@trimtime.pro>")
console.log("\nDepois de salvar variáveis: Redeploy obrigatório.")

await prisma.$disconnect()
