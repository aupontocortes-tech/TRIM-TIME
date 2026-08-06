/**
 * Remove todos os dados do teste de estresse ADM1 (manifesto).
 * Uso: node scripts/stress-test-adm-cleanup.mjs
 */
import {
  MANIFEST_PATH,
  SNAPSHOT_PATH,
  createPrisma,
  readJson,
  writeJson,
} from "./stress-test-adm-lib.mjs"
import fs from "fs"

const prisma = createPrisma()
const BATCH = 500

async function deleteIds(model, ids, label) {
  if (!ids.length) return
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    await model.deleteMany({ where: { id: { in: chunk } } })
    process.stdout.write(`\r  ${label}: ${Math.min(i + BATCH, ids.length)}/${ids.length}`)
  }
  process.stdout.write("\n")
}

try {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifesto não encontrado: ${MANIFEST_PATH}`)
    process.exit(1)
  }

  const manifest = readJson(MANIFEST_PATH)
  const { created, barbershopId } = manifest

  console.log(`\n=== Limpeza teste de estresse (${manifest.runId}) ===`)
  console.log(`Barbershop: ${barbershopId}`)

  // Ordem respeitando FKs (Restrict em appointment → client/barber/service)
  await deleteIds(prisma.appointmentServiceLine, created.appointmentServiceLines ?? [], "linhas serviço")
  await deleteIds(prisma.appointmentRetailLine, [], "linhas varejo")

  // Logs/ledger ligados a agendamentos de teste (se existirem)
  if (created.appointments?.length) {
    await prisma.notificationLog.deleteMany({
      where: { appointmentId: { in: created.appointments } },
    })
    await prisma.financialLedgerEntry.deleteMany({
      where: { appointmentId: { in: created.appointments } },
    })
    await prisma.loyaltyLedgerEntry.deleteMany({
      where: { appointmentId: { in: created.appointments } },
    })
  }

  await deleteIds(prisma.appointment, created.appointments ?? [], "agendamentos")

  if (created.clients?.length) {
    await prisma.waitingListItem.deleteMany({
      where: { clientId: { in: created.clients } },
    })
    await prisma.notificationLog.deleteMany({
      where: { clientId: { in: created.clients } },
    })
    await prisma.loyaltyLedgerEntry.deleteMany({
      where: { clientId: { in: created.clients } },
    })
  }

  await deleteIds(prisma.barber, created.barbers ?? [], "barbeiros")
  await deleteIds(prisma.client, created.clients ?? [], "clientes")

  // Serviços/unidades de teste — não criamos no seed atual
  if (created.services?.length) {
    await deleteIds(prisma.service, created.services, "serviços")
  }
  if (created.units?.length) {
    await deleteIds(prisma.barbershopUnit, created.units, "unidades")
  }

  manifest.cleanedAt = new Date().toISOString()
  writeJson(MANIFEST_PATH.replace(".json", "-cleaned.json"), manifest)
  fs.unlinkSync(MANIFEST_PATH)

  console.log("\nManifesto removido. Rode: node scripts/stress-test-adm-verify.mjs")
} finally {
  await prisma.$disconnect()
}
