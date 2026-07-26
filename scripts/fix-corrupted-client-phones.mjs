/**
 * Corrige telefones corrompidos por formatPhone quando o usuário digitava com DDI 55.
 * Ex.: 5561993464651 virava (55) 61993-4651 — perdia dígitos e duplicava 55 no envio.
 */
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function stripBrazilPhoneDigits(value) {
  let numbers = value.replace(/\D/g, "")
  if (numbers.startsWith("55") && numbers.length > 11) numbers = numbers.slice(2)
  return numbers.slice(0, 11)
}

function formatPhoneBr(value) {
  const numbers = stripBrazilPhoneDigits(value)
  if (numbers.length <= 2) return numbers.length ? `(${numbers}` : ""
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

/** Não recupera automaticamente — 4651 vs 5193 não dá para adivinhar. Corrija manualmente no painel. */
function recoverFullBrazilDigits(_storedPhone) {
  return null
}

try {
  const clients = await prisma.client.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true },
  })

  let fixed = 0
  for (const c of clients) {
    if (!c.phone) continue
    const recovered = recoverFullBrazilDigits(c.phone)
    if (!recovered) continue
    const formatted = formatPhoneBr(recovered)
    await prisma.client.update({
      where: { id: c.id },
      data: { phone: formatted },
    })
    console.log("Corrigido:", c.name, c.phone, "→", formatted)
    fixed++
  }
  console.log(fixed ? `OK: ${fixed} telefone(s) corrigido(s)` : "Nenhum telefone corrompido conhecido")
} finally {
  await prisma.$disconnect()
}
