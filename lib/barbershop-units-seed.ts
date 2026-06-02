import { prisma } from "@/lib/prisma"
import { barbershopHasMultipleUnits } from "@/lib/unit-context"

/**
 * Toda barbearia deve ter pelo menos uma linha em `barbershop_units` (unidade principal = nome da rede),
 * senão o seletor do painel não lista a "primeira loja" e só aparecem unidades adicionadas depois.
 */
export async function seedPrimaryUnitIfNoUnits(barbershopId: string): Promise<void> {
  const n = await prisma.barbershopUnit.count({ where: { barbershopId } })
  if (n > 0) return
  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { name: true, createdAt: true },
  })
  if (!barbershop?.name?.trim()) return
  await prisma.barbershopUnit.create({
    data: {
      barbershopId,
      name: barbershop.name.trim(),
      active: true,
      createdAt: barbershop.createdAt,
    },
  })
}

/**
 * Agendamentos antigos com `unit_id` null pertencem à unidade principal (mesmo nome da barbearia).
 * Garante que essa unidade exista e vincula os legados, para o filtro por unidade no painel fazer sentido.
 */
export async function migrateLegacyNullAppointmentsToPrincipalUnit(barbershopId: string): Promise<void> {
  const nullCount = await prisma.appointment.count({
    where: { barbershopId, unitId: null },
  })
  if (nullCount === 0) return

  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { name: true, createdAt: true },
  })
  if (!barbershop?.name?.trim()) return

  let principal = await prisma.barbershopUnit.findFirst({
    where: { barbershopId, name: barbershop.name.trim() },
  })
  if (!principal) {
    principal = await prisma.barbershopUnit.create({
      data: {
        barbershopId,
        name: barbershop.name.trim(),
        active: true,
        createdAt: barbershop.createdAt,
      },
    })
  }

  await prisma.appointment.updateMany({
    where: { barbershopId, unitId: null },
    data: { unitId: principal.id },
  })
}

/**
 * Caso comum: só existia a conta da barbearia e a primeira unidade explícita foi cadastrada como "segunda"
 * (ex.: ADM2), sem linha para a loja principal com o nome da rede. Recria essa unidade para o seletor do painel.
 */
export async function repairMissingPrincipalWhenSingleMismatchedUnit(barbershopId: string): Promise<void> {
  const barbershop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { name: true, createdAt: true },
  })
  const principalName = barbershop?.name?.trim()
  if (!principalName || !barbershop) return

  const units = await prisma.barbershopUnit.findMany({
    where: { barbershopId },
    orderBy: { createdAt: "asc" },
    select: { name: true },
  })
  if (units.length !== 1) return
  if (units[0].name.trim() === principalName) return

  await prisma.barbershopUnit.create({
    data: {
      barbershopId,
      name: principalName,
      active: true,
      createdAt: barbershop.createdAt,
    },
  })
}

/**
 * Vincula barbeiros sem `unit_id` à única unidade ativa (barbearia com uma loja).
 * Com 2+ unidades não preenche automaticamente — cada filial cadastra sua equipe.
 */
export async function assignBarbersWithoutUnit(barbershopId: string): Promise<void> {
  const activeUnits = await prisma.barbershopUnit.findMany({
    where: { barbershopId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (activeUnits.length !== 1) return

  const principalUnitId = activeUnits[0].id
  const orphans = await prisma.barber.count({
    where: { barbershopId, unitId: null },
  })
  if (orphans === 0) return

  await prisma.barber.updateMany({
    where: { barbershopId, unitId: null },
    data: { unitId: principalUnitId },
  })
}

/**
 * Com 2+ unidades: profissionais legados sem `unit_id` ficam só na primeira loja (ADM / ADN1).
 * Não preenche a unidade 2 — cada filial cadastra equipe nova.
 */
export async function assignOrphanBarbersToPrincipalUnit(barbershopId: string): Promise<void> {
  if (!(await barbershopHasMultipleUnits(barbershopId))) return

  const principal = await prisma.barbershopUnit.findFirst({
    where: { barbershopId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!principal) return

  await prisma.barber.updateMany({
    where: { barbershopId, unitId: null },
    data: { unitId: principal.id },
  })
}

/**
 * Vincula clientes sem `unit_id` à única unidade ativa (mesma regra da equipe).
 */
export async function assignClientsWithoutUnit(barbershopId: string): Promise<void> {
  const activeUnits = await prisma.barbershopUnit.findMany({
    where: { barbershopId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (activeUnits.length !== 1) return

  const principalUnitId = activeUnits[0].id
  const orphans = await prisma.client.count({
    where: { barbershopId, unitId: null },
  })
  if (orphans === 0) return

  await prisma.client.updateMany({
    where: { barbershopId, unitId: null },
    data: { unitId: principalUnitId },
  })
}
