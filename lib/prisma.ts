/**
 * Cliente Prisma singleton para uso em API routes e Server Components.
 * Prisma 7 exige adapter para PostgreSQL; evita múltiplas instâncias em dev (hot reload).
 *
 * Inicialização **lazy** (via Proxy): o `next build` importa rotas e não deve falhar só porque
 * `DATABASE_URL` ainda não está disponível no passo de “Collecting page data”. Na Vercel, sem
 * `DATABASE_URL` em runtime, a primeira query ainda falha com a mensagem clara abaixo.
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

/**
 * Em desenvolvimento o Next reaproveita este singleton no hot reload. Depois de rodar
 * `npx prisma generate` ou alterar `prisma/schema.prisma`, reinicie `npm run dev` —
 * senão o cliente antigo pode acusar "Unknown field …" em queries novas.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient(): PrismaClient {
  const connectionString = getDatabaseUrl()
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
}

/** Singleton em produção (módulo em cache); em dev usa global para hot reload. */
let prismaProduction: PrismaClient | undefined

function getClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return globalForPrisma.prisma
  }
  if (!prismaProduction) {
    prismaProduction = createPrismaClient()
  }
  return prismaProduction
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient()
    const value = Reflect.get(client as object, prop, client)
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }
    return value
  },
})
