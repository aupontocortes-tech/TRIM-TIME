/**
 * Aplica no banco (uma vez ou quando quiser repetir):
 * - SUPER_ADMIN_EMAIL → role super_admin
 * - TRIMTIME_TEST_BARBERSHOP_EMAIL → is_test true (plano efetivo premium sem pagamento)
 *
 * Requer DATABASE_URL + e-mails em .env.local (ou .env). Barbearias já devem existir.
 *
 * Uso: npm run db:set-trimtime-accounts
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
dotenv.config({ path: path.join(root, ".env.local") })
dotenv.config({ path: path.join(root, ".env") })
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("Defina DATABASE_URL (ex. copie .env.example → .env.local).")
  process.exit(1)
}

const superEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
const testEmail = process.env.TRIMTIME_TEST_BARBERSHOP_EMAIL?.trim().toLowerCase()

if (!superEmail && !testEmail) {
  console.error(
    "Defina no .env.local pelo menos uma variável:\n" +
      "  SUPER_ADMIN_EMAIL\n" +
      "  TRIMTIME_TEST_BARBERSHOP_EMAIL"
  )
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function main() {
  if (testEmail) {
    const r = await prisma.barbershop.updateMany({
      where: { email: testEmail },
      data: { role: "admin_barbershop", isTest: true },
    })
    console.log(`conta de teste (${testEmail}): ${r.count} → admin_barbershop + is_test.`)
    if (r.count === 0) {
      console.warn("Nenhuma linha — cadastre a barbearia com esse e-mail antes.")
    }
  }
  if (superEmail) {
    if (testEmail && superEmail === testEmail) {
      console.warn("SUPER_ADMIN_EMAIL e TRIMTIME_TEST_BARBERSHOP_EMAIL iguais — use e-mails diferentes.")
    } else {
      const r = await prisma.barbershop.updateMany({
        where: { email: superEmail },
        data: { role: "super_admin", isTest: false },
      })
      console.log(`super_admin (${superEmail}): ${r.count} atualizada(s).`)
      if (r.count === 0) {
        console.warn("Nenhuma linha — cadastre a barbearia com esse e-mail antes.")
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
