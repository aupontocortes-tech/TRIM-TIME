import { NextResponse } from "next/server"
import { getRealBarbershopIdFromRequest } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

export type SuperAdminCheck =
  | { ok: true; barbershopId: string }
  | { ok: false; response: NextResponse }

/** Cookie de sessão deve ser de uma barbearia com role super_admin. */
export async function requireSuperAdmin(): Promise<SuperAdminCheck> {
  const id = await getRealBarbershopIdFromRequest()
  if (!id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
    }
  }
  const me = await prisma.barbershop.findUnique({
    where: { id },
    select: { role: true },
  })
  if (me?.role !== "super_admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
    }
  }
  return { ok: true, barbershopId: id }
}
