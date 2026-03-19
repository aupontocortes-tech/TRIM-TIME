import dotenv from "dotenv"
import { defineConfig } from "prisma/config"

// Carrega .env.local primeiro (onde ficam as chaves do Supabase), depois .env
dotenv.config({ path: ".env.local" })
dotenv.config()

// Prisma CLI (db push, migrate) usa conexão direta; app usa DATABASE_URL (pooler)
const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "postgresql://localhost:5432/trimtime"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
})
