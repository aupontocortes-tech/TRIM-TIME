/**
 * Cliente Prisma singleton para uso em API routes e Server Components.
 * Prisma 7 exige adapter para PostgreSQL; evita múltiplas instâncias em dev (hot reload).
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Placeholder para build quando DATABASE_URL não existir; em runtime use .env.local com URL real (Supabase).
const connectionString = process.env.DATABASE_URL || "postgresql://localhost:5432/trimtime"
const adapter = new PrismaPg({ connectionString })

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
