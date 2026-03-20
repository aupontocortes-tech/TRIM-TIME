/**
 * Cliente Prisma singleton para uso em API routes e Server Components.
 * Prisma 7 exige adapter para PostgreSQL; evita múltiplas instâncias em dev (hot reload).
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (url) return url
  // Na Vercel sem DATABASE_URL o fallback ia para localhost e o Prisma falhava com 127.0.0.1:5432
  const onVercel = process.env.VERCEL === "1"
  if (onVercel) {
    throw new Error(
      "DATABASE_URL não está definida na Vercel. Vá em Settings → Environment Variables → Production " +
        "e adicione DATABASE_URL (connection string do Postgres no Supabase, modo Session pooler, porta 6543). " +
        "É o mesmo valor do .env.local no PC. Opcional: DIRECT_DATABASE_URL (conexão direta :5432) para migrações locais. " +
        "Guia: docs/VERCEL_DEPLOY.md"
    )
  }
  return "postgresql://localhost:5432/trimtime"
}

const connectionString = getDatabaseUrl()
const adapter = new PrismaPg({ connectionString })

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
