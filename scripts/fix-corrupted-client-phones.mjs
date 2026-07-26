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

/** Tenta reconstruir 55 + DDD + número a partir do valor corrompido no banco. */
function recoverFullBrazilDigits(storedPhone) {
  const d = storedPhone.replace(/\D/g, "")
  if (!d.startsWith("55") || d.length !== 11) return null
  // Padrão conhecido: usuário digitou 13 dígitos; formatPhone guardou 11 começando com 55.
  // Não dá para recuperar 100% — só casos onde o DDD real é 61 e faltam "46" no meio.
  if (d === "55619934651") return "5561993464651"
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
