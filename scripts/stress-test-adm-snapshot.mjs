/**
 * Snapshot somente leitura — estado da ADM1 antes do teste de estresse.
 * Uso: node scripts/stress-test-adm-snapshot.mjs
 */
import {
  SNAPSHOT_PATH,
  STRESS_RUN_ID,
  countBarbershopEntities,
  createPrisma,
  findAdmBarbershop,
  findAdmTwoUnits,
  writeJson,
} from "./stress-test-adm-lib.mjs"

const prisma = createPrisma()

try {
  const bs = await findAdmBarbershop(prisma)
  const units = await findAdmTwoUnits(prisma, bs.id)
  const counts = await countBarbershopEntities(prisma, bs.id)

  const snapshot = {
    runId: STRESS_RUN_ID,
    capturedAt: new Date().toISOString(),
    barbershop: bs,
    targetUnits: units,
    counts,
  }

  writeJson(SNAPSHOT_PATH, snapshot)

  console.log("=== Snapshot ADM1 (somente leitura) ===")
  console.log(JSON.stringify(snapshot, null, 2))
  console.log(`\nSalvo em: ${SNAPSHOT_PATH}`)
} finally {
  await prisma.$disconnect()
}
