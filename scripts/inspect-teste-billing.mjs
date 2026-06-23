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

const bs = await prisma.barbershop.findFirst({
  where: {
    OR: [
      { name: { equals: "teste", mode: "insensitive" } },
      { slug: "teste" },
    ],
  },
})

if (!bs) {
  console.log("Barbearia teste nao encontrada")
  process.exit(1)
}

const sub = await prisma.subscription.findUnique({ where: { barbershopId: bs.id } })
const payments = await prisma.payment.findMany({
  where: { barbershopId: bs.id },
  orderBy: { createdAt: "desc" },
})

console.log(
  JSON.stringify(
    {
      barbershop: {
        id: bs.id,
        name: bs.name,
        slug: bs.slug,
        email: bs.email,
        isTest: bs.isTest,
        role: bs.role,
      },
      subscription: sub,
      payments,
    },
    null,
    2
  )
)

await prisma.$disconnect()
