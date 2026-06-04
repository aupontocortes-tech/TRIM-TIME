import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  appointmentApiInclude,
  type AppointmentWithRelations,
} from "@/lib/appointment-prisma-helpers"
import {
  appointmentsUnitColumnReady,
  withAppointmentDbSchema,
} from "@/lib/appointment-db-schema"
import { prismaAppointmentUnitFilter } from "@/lib/unit-context"

/** Campos de cliente usados na agenda (evita `client: true` quando `unit_id` ainda não existe). */
export const appointmentClientSelect = {
  id: true,
  barbershopId: true,
  unitId: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
  cpf: true,
  photoUrl: true,
  loyaltyPoints: true,
  pushSubscription: true,
  createdAt: true,
  updatedAt: true,
} as const

/** Include seguro: barbeiro sem colunas opcionais que podem faltar no banco. */
export const appointmentApiIncludeSafe = {
  client: { select: appointmentClientSelect },
  barber: {
    select: {
      id: true,
      barbershopId: true,
      unitId: true,
      name: true,
      phone: true,
      email: true,
      cpf: true,
      photoUrl: true,
      commission: true,
      active: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  service: true,
  appointmentRetailLines: { include: { retailProduct: true } },
  appointmentServiceLines: { include: { service: true } },
} satisfies Prisma.AppointmentInclude

async function barberIdsForUnit(
  barbershopId: string,
  unitId: string
): Promise<string[]> {
  try {
    const rows = await prisma.barber.findMany({
      where: { barbershopId, unitId },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  } catch {
    return []
  }
}

/** Filtro por unidade com fallback quando `unit_id` ainda não existe na tabela. */
export async function buildAppointmentListWhere(
  barbershopId: string,
  selectedUnitId: string | null,
  extra: Prisma.AppointmentWhereInput = {}
): Promise<Prisma.AppointmentWhereInput> {
  const base: Prisma.AppointmentWhereInput = { barbershopId, ...extra }
  if (!selectedUnitId) return base

  if (await appointmentsUnitColumnReady()) {
    return { ...base, ...prismaAppointmentUnitFilter(selectedUnitId) }
  }

  const barberIds = await barberIdsForUnit(barbershopId, selectedUnitId)
  if (barberIds.length === 0) {
    return { ...base, barberId: { in: [] } }
  }
  return { ...base, barberId: { in: barberIds } }
}

export async function fetchAppointmentsWithRelations(
  where: Prisma.AppointmentWhereInput,
  orderBy: Prisma.AppointmentOrderByWithRelationInput[] = [{ date: "asc" }, { time: "asc" }]
): Promise<AppointmentWithRelations[]> {
  return withAppointmentDbSchema(async () => {
    try {
      const rows = await prisma.appointment.findMany({
        where,
        include: appointmentApiIncludeSafe,
        orderBy,
      })
      return rows as AppointmentWithRelations[]
    } catch (e) {
      if (!isMissingColumnError(e)) throw e
      const rows = await prisma.appointment.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              barbershopId: true,
              name: true,
              phone: true,
              email: true,
              notes: true,
              cpf: true,
              photoUrl: true,
              loyaltyPoints: true,
              pushSubscription: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          barber: {
            select: {
              id: true,
              barbershopId: true,
              name: true,
              phone: true,
              email: true,
              cpf: true,
              photoUrl: true,
              commission: true,
              active: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          service: true,
        },
        orderBy,
      })
      return rows as AppointmentWithRelations[]
    }
  })
}

function isMissingColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes("(not available)") || msg.includes("does not exist")
}
