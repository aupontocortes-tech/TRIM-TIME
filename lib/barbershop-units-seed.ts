import { prisma } from "@/lib/prisma"

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
 * Vincula barbeiros sem `unit_id` à unidade correta (histórico de agendamentos ou unidade única).
 * Necessário em barbearias com 2+ unidades — a migration 028 só preenche automaticamente quando há 1 unidade.
 */
export async function assignBarbersWithoutUnit(barbershopId: string): Promise<void> {
  const orphans = await prisma.barber.findMany({
    where: { barbershopId, unitId: null },
    select: { id: true },
  })
  if (orphans.length === 0) return

  const activeUnits = await prisma.barbershopUnit.findMany({
    where: { barbershopId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (activeUnits.length === 0) return

  if (activeUnits.length === 1) {
    await prisma.barber.updateMany({
      where: { barbershopId, unitId: null },
      data: { unitId: activeUnits[0].id },
    })
    return
  }

  for (const { id: barberId } of orphans) {
    const grouped = await prisma.appointment.groupBy({
      by: ["unitId"],
      where: {
        barberId,
        barbershopId,
        unitId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })

    const topUnitId = grouped[0]?.unitId ?? activeUnits[0].id

    await prisma.barber.update({
      where: { id: barberId },
      data: { unitId: topUnitId },
    })
  }
}
