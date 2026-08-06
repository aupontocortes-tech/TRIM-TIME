/**
 * Cria dados de estresse na ADM1 (slug adm) — 100 barbeiros nas 2 unidades existentes,
 * clientes fictícios e 10.000 agendamentos em 7 dias.
 *
 * Uso: node scripts/stress-test-adm-seed.mjs
 * Limpeza: node scripts/stress-test-adm-cleanup.mjs
 */
import {
  MANIFEST_PATH,
  SNAPSHOT_PATH,
  STRESS_DAYS,
  STRESS_RUN_ID,
  STRESS_TAG,
  SLOT_TIMES,
  TARGET_APPOINTMENTS,
  TARGET_BARBERS,
  TARGET_CLIENTS,
  addDaysYmd,
  countBarbershopEntities,
  createPrisma,
  findAdmBarbershop,
  findAdmTwoUnits,
  mulberry32,
  pickStatusForSlot,
  slotWeight,
  stressEmail,
  stressName,
  stressPhone,
  todayYmdUtc,
  utcDateFromYmd,
  uuid,
  writeJson,
} from "./stress-test-adm-lib.mjs"
import fs from "fs"

const prisma = createPrisma()
const rng = mulberry32(0x5f3759df)
const BATCH = 500

async function createManyBatched(model, rows, label) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    await model.createMany({ data: chunk, skipDuplicates: true })
    process.stdout.write(`\r  ${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }
  process.stdout.write("\n")
}

try {
  if (fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifesto já existe: ${MANIFEST_PATH}`)
    console.error("Rode stress-test-adm-cleanup.mjs antes de semear de novo.")
    process.exit(1)
  }

  const bs = await findAdmBarbershop(prisma)
  const units = await findAdmTwoUnits(prisma, bs.id)
  console.log(`\n=== Teste de estresse ADM1 ===`)
  console.log(`Barbearia: ${bs.name} (${bs.slug})`)
  console.log(`Unidades: ${units.map((u) => u.name).join(" + ")}`)

  // Snapshot antes (se não existir)
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    const counts = await countBarbershopEntities(prisma, bs.id)
    writeJson(SNAPSHOT_PATH, {
      runId: STRESS_RUN_ID,
      capturedAt: new Date().toISOString(),
      barbershop: bs,
      targetUnits: units,
      counts,
    })
    console.log(`Snapshot salvo: ${SNAPSHOT_PATH}`)
  }

  const services = await prisma.service.findMany({
    where: { barbershopId: bs.id, active: true },
    select: { id: true, name: true, price: true, duration: true },
    orderBy: { createdAt: "asc" },
  })
  if (services.length === 0) {
    throw new Error("ADM1 não tem serviços ativos. Cadastre ao menos 1 serviço antes do teste.")
  }
  console.log(`Serviços reutilizados: ${services.length}`)

  const manifest = {
    runId: STRESS_RUN_ID,
    startedAt: new Date().toISOString(),
    barbershopId: bs.id,
    unitIds: units.map((u) => u.id),
    serviceIds: services.map((s) => s.id),
    created: {
      barbers: [],
      clients: [],
      appointments: [],
      appointmentServiceLines: [],
    },
  }

  // --- Barbeiros (50 + 50) ---
  console.log(`\nCriando ${TARGET_BARBERS} barbeiros...`)
  const barberRows = []
  for (let i = 0; i < TARGET_BARBERS; i++) {
    const unit = units[i < TARGET_BARBERS / 2 ? 0 : 1]
    const id = uuid()
    manifest.created.barbers.push(id)
    barberRows.push({
      id,
      barbershopId: bs.id,
      unitId: unit.id,
      name: stressName(`Barbeiro ${i + 1}`),
      phone: stressPhone(1000 + i),
      email: stressEmail(`barber${i + 1}`),
      active: true,
      role: "user",
      commission: 30,
    })
  }
  await createManyBatched(prisma.barber, barberRows, "barbeiros")

  // --- Clientes ---
  console.log(`Criando ${TARGET_CLIENTS} clientes...`)
  const clientRows = []
  for (let i = 0; i < TARGET_CLIENTS; i++) {
    const id = uuid()
    manifest.created.clients.push(id)
    clientRows.push({
      id,
      barbershopId: bs.id,
      unitId: null,
      name: stressName(`Cliente ${i + 1}`),
      phone: stressPhone(5000 + i),
      email: stressEmail(`client${i + 1}`),
      notes: STRESS_TAG,
    })
  }
  await createManyBatched(prisma.client, clientRows, "clientes")

  // --- Agendamentos ---
  console.log(`Gerando ${TARGET_APPOINTMENTS} agendamentos (${STRESS_DAYS} dias)...`)
  const todayYmd = todayYmdUtc()
  const barberIds = manifest.created.barbers
  const clientIds = manifest.created.clients

  // Pool ponderado de slots (barbeiro × dia × hora)
  const weightedSlots = []
  for (let day = 0; day < STRESS_DAYS; day++) {
    const ymd = addDaysYmd(todayYmd, day)
      for (let bi = 0; bi < barberIds.length; bi++) {
      const barberId = barberIds[bi]
      const unitIdx = bi < TARGET_BARBERS / 2 ? 0 : 1
      const unitId = units[unitIdx].id
      for (const time of SLOT_TIMES) {
        const w = slotWeight(day, time)
        const copies = Math.max(1, Math.round(w * 2))
        for (let c = 0; c < copies; c++) {
          weightedSlots.push({ ymd, time, barberId, unitId, w })
        }
      }
    }
  }

  // Fisher-Yates shuffle parcial — pegar TARGET_APPOINTMENTS únicos
  const used = new Set()
  const appointmentRows = []
  const serviceLineRows = []

  let attempts = 0
  while (appointmentRows.length < TARGET_APPOINTMENTS && attempts < weightedSlots.length * 3) {
    attempts++
    const slot = weightedSlots[Math.floor(rng() * weightedSlots.length)]
    const key = `${slot.barberId}|${slot.ymd}|${slot.time}`
    if (used.has(key)) continue
    used.add(key)

    const apptId = uuid()
    const clientId = clientIds[Math.floor(rng() * clientIds.length)]
    const service = services[Math.floor(rng() * services.length)]
    const status = pickStatusForSlot(slot.ymd, slot.time, todayYmd, rng)
    const price = service.price

    manifest.created.appointments.push(apptId)
    appointmentRows.push({
      id: apptId,
      barbershopId: bs.id,
      clientId,
      barberId: slot.barberId,
      serviceId: service.id,
      unitId: slot.unitId,
      date: utcDateFromYmd(slot.ymd),
      time: slot.time,
      status,
      totalPrice: status === "completed" ? price : null,
      commissionPercent: status === "completed" ? 30 : null,
      commissionAmount:
        status === "completed" ? Number(price) * 0.3 : null,
    })

    const lineId = uuid()
    manifest.created.appointmentServiceLines.push(lineId)
    serviceLineRows.push({
      id: lineId,
      appointmentId: apptId,
      serviceId: service.id,
      quantity: 1,
      unitPrice: price,
    })
  }

  if (appointmentRows.length < TARGET_APPOINTMENTS) {
    throw new Error(
      `Só foi possível gerar ${appointmentRows.length}/${TARGET_APPOINTMENTS} slots únicos.`
    )
  }

  console.log(`Inserindo agendamentos...`)
  await createManyBatched(prisma.appointment, appointmentRows, "agendamentos")
  await createManyBatched(prisma.appointmentServiceLine, serviceLineRows, "linhas de serviço")

  manifest.finishedAt = new Date().toISOString()
  manifest.stats = {
    barbers: manifest.created.barbers.length,
    clients: manifest.created.clients.length,
    appointments: manifest.created.appointments.length,
    appointmentServiceLines: manifest.created.appointmentServiceLines.length,
    occupancyApprox:
      Math.round((manifest.created.appointments.length / (barberIds.length * SLOT_TIMES.length * STRESS_DAYS)) * 100) +
      "%",
  }

  writeJson(MANIFEST_PATH, manifest)

  const after = await countBarbershopEntities(prisma, bs.id)

  console.log("\n=== Concluído ===")
  console.log(JSON.stringify(manifest.stats, null, 2))
  console.log(`\nContagens após seed:`)
  console.log(JSON.stringify(after, null, 2))
  console.log(`\nManifesto: ${MANIFEST_PATH}`)
  console.log(`\nPara desfazer: node scripts/stress-test-adm-cleanup.mjs`)
} finally {
  await prisma.$disconnect()
}
