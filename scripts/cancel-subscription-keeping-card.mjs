import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const slug = process.argv[2]?.trim() || "teste"
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

const bs = await prisma.barbershop.findFirst({
  where: { OR: [{ slug }, { name: { equals: slug, mode: "insensitive" } }] },
  select: { id: true, name: true },
})
if (!bs) {
  console.error("Barbearia não encontrada:", slug)
  process.exit(1)
}

const before = await prisma.subscription.findUnique({ where: { barbershopId: bs.id } })
await prisma.subscription.update({
  where: { barbershopId: bs.id },
  data: {
    status: "canceled",
    nextPayment: null,
    asaasSubscriptionId: null,
    asaasPixAutomaticAuthId: null,
    postTrialChoice: null,
    graceAccessUntil: null,
    trialEnd: null,
  },
})
const after = await prisma.subscription.findUnique({ where: { barbershopId: bs.id } })
console.log(`${bs.name}: ${before?.status} → ${after?.status} (cartão mantido: ${!!after?.cardSetupAt})`)
await prisma.$disconnect()
