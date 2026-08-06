/**
 * Verifica se a ADM1 voltou ao estado do snapshot (pós-limpeza).
 * Uso: node scripts/stress-test-adm-verify.mjs
 */
import {
  SNAPSHOT_PATH,
  countBarbershopEntities,
  createPrisma,
} from "./stress-test-adm-lib.mjs"
import fs from "fs"

const prisma = createPrisma()

try {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`Snapshot não encontrado: ${SNAPSHOT_PATH}`)
    process.exit(1)
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"))
  const bsId = snapshot.barbershop.id
  const current = await countBarbershopEntities(prisma, bsId)

  const stressBarbers = await prisma.barber.count({
    where: { barbershopId: bsId, name: { startsWith: "[STRESS]" } },
  })
  const stressClients = await prisma.client.count({
    where: { barbershopId: bsId, name: { startsWith: "[STRESS]" } },
  })
  const stressAppts = await prisma.appointment.count({
    where: {
      barbershopId: bsId,
      barber: { name: { startsWith: "[STRESS]" } },
    },
  })

  const expected = snapshot.counts
  let ok = true
  const diffs = []

  for (const key of Object.keys(expected)) {
    if (current[key] !== expected[key]) {
      ok = false
      diffs.push({ table: key, before: expected[key], now: current[key] })
    }
  }

  console.log("=== Verificação pós-limpeza ADM1 ===")
  console.log(JSON.stringify({ countsMatch: ok, diffs, stressRemaining: { stressBarbers, stressClients, stressAppts } }, null, 2))

  if (stressBarbers || stressClients || stressAppts) {
    console.error("\nAinda existem registros [STRESS] no banco.")
    process.exit(1)
  }

  if (!ok) {
    console.error("\nContagens não batem com o snapshot — revise manualmente.")
    process.exit(1)
  }

  console.log("\nOK — ADM1 restaurada ao estado anterior ao teste.")
} finally {
  await prisma.$disconnect()
}
