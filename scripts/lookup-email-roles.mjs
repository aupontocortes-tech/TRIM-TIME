/**
 * Uso: node scripts/lookup-email-roles.mjs seu@email.com
 * Mostra em quais tabelas o e-mail aparece (dono, barbeiro, cliente).
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

const emailArg = process.argv[2]?.trim()
if (!emailArg) {
  console.error("Uso: node scripts/lookup-email-roles.mjs seu@email.com")
  process.exit(1)
}

function normalize(s) {
  return s.trim().toLowerCase()
}

function canonicalGmail(n) {
  const at = n.lastIndexOf("@")
  if (at <= 0) return n
  const local = n.slice(0, at)
  const domain = n.slice(at + 1)
  const dom =
    domain === "googlemail.com" ? "gmail.com" : domain === "googlemail.com.br" ? "gmail.com" : domain
  if (dom !== "gmail.com") return `${local}@${domain}`
  const plus = local.split("+")[0] ?? local
  return `${plus.replace(/\./g, "")}@gmail.com`
}

function emailsMatch(a, b) {
  const na = canonicalGmail(normalize(a))
  const nb = canonicalGmail(normalize(b))
  return na === nb
}

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error("Defina DATABASE_URL em .env.local")
  process.exit(1)
}
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

const needle = normalize(emailArg)
const canon = canonicalGmail(needle)

try {
  const [shops, barbers, clients, otpSends, signupTokens] = await Promise.all([
    prisma.barbershop.findMany({
      select: { id: true, name: true, email: true, slug: true, role: true, phone: true },
    }),
    prisma.barber.findMany({
      where: { email: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        barbershopId: true,
        portalToken: true,
        barbershop: { select: { name: true, slug: true } },
      },
    }),
    prisma.client.findMany({
      where: { email: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        barbershopId: true,
        barbershop: { select: { name: true, slug: true } },
      },
    }),
    prisma.painelSignupOtpSend.findMany({
      where: { email: { contains: needle.split("@")[0], mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { email: true, createdAt: true },
    }),
    prisma.painelSignupToken.findMany({
      where: { email: { contains: canon.split("@")[0], mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { email: true, usedAt: true, expiresAt: true },
    }),
  ])

  const owner = shops.filter((s) => emailsMatch(s.email, emailArg))
  const barber = barbers.filter((b) => b.email && emailsMatch(b.email, emailArg))
  const client = clients.filter((c) => c.email && emailsMatch(c.email, emailArg))

  console.log("\n=== Consulta:", emailArg, "===")
  console.log("Gmail canônico (cadastro dono):", canon)
  console.log("")

  console.log("DONO da barbearia (Barbershop):", owner.length ? "SIM" : "não")
  for (const s of owner) {
    console.log(`  - ${s.name} | slug: ${s.slug} | role: ${s.role} | id: ${s.id}`)
  }

  console.log("\nBARBEIRO (Barber):", barber.length ? "SIM" : "não")
  for (const b of barber) {
    console.log(`  - ${b.name} @ ${b.barbershop?.name ?? b.barbershopId} | id: ${b.id}`)
  }

  console.log("\nCLIENTE (Client):", client.length ? "SIM" : "não")
  for (const c of client) {
    console.log(`  - ${c.name} @ ${c.barbershop?.name ?? c.barbershopId} | id: ${c.id}`)
  }

  const otpMatch = otpSends.filter((o) => emailsMatch(o.email, emailArg))
  console.log("\nOTP cadastro dono (auditoria):", otpMatch.length, "envio(s) recente(s)")

  const tokMatch = signupTokens.filter((t) => emailsMatch(t.email, emailArg))
  console.log("Tokens cadastro dono:", tokMatch.length)

  console.log("\n--- Cadastro NOVO de barbearia (/cadastro) ---")
  if (owner.length) {
    console.log("Bloqueado: e-mail já é DONO de barbearia (erro 409, OTP nem chega a ser o problema principal).")
  } else {
    console.log("OK no Postgres para criar nova Barbershop com este e-mail.")
    console.log("Se OTP falhar, apague o usuário em Supabase → Authentication → Users (mesmo e-mail).")
  }
} finally {
  await prisma.$disconnect()
}
