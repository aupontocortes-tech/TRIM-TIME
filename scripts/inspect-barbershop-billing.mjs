import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const query = process.argv[2]?.trim() || "teste"
const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("DATABASE_URL ausente")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

const bs = await prisma.barbershop.findFirst({
  where: {
    OR: [
      { name: { equals: query, mode: "insensitive" } },
      { slug: { equals: query, mode: "insensitive" } },
    ],
  },
  select: { id: true, name: true, email: true, slug: true, role: true, isTest: true },
})

if (!bs) {
  console.error(`Barbearia não encontrada: ${query}`)
  process.exit(1)
}

const sub = await prisma.subscription.findUnique({ where: { barbershopId: bs.id } })
const payments = await prisma.payment.findMany({
  where: { barbershopId: bs.id },
  orderBy: { createdAt: "desc" },
  take: 8,
})

console.log(JSON.stringify({ barbershop: bs, subscription: sub, payments }, null, 2))
await prisma.$disconnect()
