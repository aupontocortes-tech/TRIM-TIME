/**
 * Utilitários compartilhados — teste de estresse ADM1 (slug adm).
 * Dados marcados com prefixo [STRESS] e tag __STRESS_RUN__.
 */
import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import crypto from "crypto"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(root, ".env.local") })

export const STRESS_PREFIX = "[STRESS]"
export const STRESS_RUN_ID = "20260806-adm"
export const STRESS_TAG = `__STRESS_RUN__:${STRESS_RUN_ID}`
export const MANIFEST_PATH = path.join(root, "scripts", "stress-test-adm-manifest.json")
export const SNAPSHOT_PATH = path.join(root, "scripts", "stress-test-adm-snapshot-before.json")

export const TARGET_BARBERS = 100
export const TARGET_CLIENTS = 1500
export const TARGET_APPOINTMENTS = 10_000
export const STRESS_DAYS = 7

/** Horários de funcionamento simulados (30 min). */
export const SLOT_TIMES = []
for (let h = 9; h <= 18; h++) {
  SLOT_TIMES.push(`${String(h).padStart(2, "0")}:00`)
  SLOT_TIMES.push(`${String(h).padStart(2, "0")}:30`)
}
// 20 slots/dia

export function createPrisma() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error("DATABASE_URL ausente em .env.local")
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
}

export function stressName(label) {
  return `${STRESS_PREFIX} ${label}`
}

export function stressEmail(index) {
  return `stress+${STRESS_RUN_ID}+${index}@stress.invalid`
}

/** Telefone fictício — faixa 551199900xxxx */
export function stressPhone(index) {
  const n = String(index).padStart(4, "0").slice(-4)
  return `551199900${n}${String(index % 100).padStart(2, "0")}`
}

export function isStressName(name) {
  return typeof name === "string" && name.startsWith(STRESS_PREFIX)
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8")
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

export function addDaysYmd(baseDate, days) {
  const d = new Date(baseDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function utcDateFromYmd(ymd) {
  return new Date(`${ymd}T12:00:00.000Z`)
}

export function todayYmdUtc() {
  return new Date().toISOString().slice(0, 10)
}

export async function findAdmBarbershop(prisma) {
  const superEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
  const bs = await prisma.barbershop.findFirst({
    where: superEmail
      ? { OR: [{ slug: "adm" }, { email: superEmail, role: "super_admin" }] }
      : { slug: "adm" },
    select: { id: true, name: true, slug: true, email: true },
  })
  if (!bs) throw new Error("Barbearia ADM1 (slug adm) não encontrada.")
  return bs
}

/** Usa ADM + ADM2 se existirem; senão as 2 primeiras unidades ativas. */
export async function findAdmTwoUnits(prisma, barbershopId) {
  const units = await prisma.barbershopUnit.findMany({
    where: { barbershopId, active: true, archivedByUser: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  })
  if (units.length < 2) {
    throw new Error(
      `ADM1 precisa de pelo menos 2 unidades ativas (encontradas: ${units.length}). Crie ADM2 antes do teste.`
    )
  }

  const byName = (name) =>
    units.find((u) => u.name.trim().toLowerCase() === name.trim().toLowerCase())

  const adm2 = byName("ADM2")
  const adm =
    byName("ADM") ??
    units.find((u) => u.name.trim().toLowerCase() === "adm") ??
    units[0]

  const picked = []
  const seen = new Set()
  for (const u of [adm, adm2, ...units]) {
    if (!u || seen.has(u.id)) continue
    seen.add(u.id)
    picked.push(u)
    if (picked.length === 2) break
  }

  return picked
}

export async function countBarbershopEntities(prisma, barbershopId) {
  const [
    units,
    barbers,
    clients,
    services,
    appointments,
    serviceLines,
    retailLines,
    waitingList,
    notificationLogs,
    financialLedger,
    loyaltyLedger,
  ] = await Promise.all([
    prisma.barbershopUnit.count({ where: { barbershopId } }),
    prisma.barber.count({ where: { barbershopId } }),
    prisma.client.count({ where: { barbershopId } }),
    prisma.service.count({ where: { barbershopId } }),
    prisma.appointment.count({ where: { barbershopId } }),
    prisma.appointmentServiceLine.count({
      where: { appointment: { barbershopId } },
    }),
    prisma.appointmentRetailLine.count({
      where: { appointment: { barbershopId } },
    }),
    prisma.waitingListItem.count({ where: { barbershopId } }),
    prisma.notificationLog.count({ where: { barbershopId } }),
    prisma.financialLedgerEntry.count({ where: { barbershopId } }),
    prisma.loyaltyLedgerEntry.count({ where: { client: { barbershopId } } }),
  ])

  return {
    units,
    barbers,
    clients,
    services,
    appointments,
    appointmentServiceLines: serviceLines,
    appointmentRetailLines: retailLines,
    waitingList: waitingList,
    notificationLogs,
    financialLedger,
    loyaltyLedger,
  }
}

export function pickStatusForSlot(ymd, time, todayYmd, rng) {
  if (ymd < todayYmd) {
    const r = rng()
    if (r < 0.68) return "completed"
    if (r < 0.88) return "canceled"
    return "no_show"
  }
  if (ymd > todayYmd) {
    return rng() < 0.55 ? "confirmed" : "pending"
  }
  // hoje
  const [hh, mm] = time.split(":").map(Number)
  const now = new Date()
  const slotMinutes = hh * 60 + mm
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  if (slotMinutes < nowMinutes - 30) {
    const r = rng()
    if (r < 0.5) return "completed"
    if (r < 0.75) return "pending_finalization"
    if (r < 0.9) return "canceled"
    return "no_show"
  }
  return rng() < 0.6 ? "confirmed" : "pending"
}

/** Peso maior em sex/sáb e horários 17–19h. */
export function slotWeight(dayIndex, time) {
  const dow = (new Date(`${addDaysYmd(todayYmdUtc(), dayIndex)}T12:00:00.000Z`).getUTCDay() + 6) % 7
  let w = 1
  if (dow >= 4) w *= 1.35 // sex/sáb
  const hour = parseInt(time.slice(0, 2), 10)
  if (hour >= 17) w *= 1.5
  if (hour >= 11 && hour <= 13) w *= 1.15
  return w
}

export function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function uuid() {
  return crypto.randomUUID()
}
