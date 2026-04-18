/**
 * Prisma client singleton — lib/db.ts
 *
 * WHY A SINGLETON?
 * Next.js hot-reloads modules in development, which would create a new
 * PrismaClient on every reload and exhaust the Postgres connection pool.
 * We store the instance on `globalThis` so hot-reloads re-use the same
 * connection pool rather than opening new ones.
 *
 * In production this module is evaluated once per worker process, so the
 * global guard is a no-op — it just ensures consistent code paths.
 *
 * LOGGING:
 * In development, all SQL queries are logged to stdout so you can inspect
 * exactly what Prisma sends to Postgres. In production only errors are
 * logged to avoid verbose output in structured JSON logs.
 *
 * USAGE:
 *   import { prisma } from '@/lib/db'
 *   const user = await prisma.user.findUnique({ where: { email } })
 *
 * MIGRATIONS:
 *   Local:      npx prisma migrate dev
 *   Production: npx prisma migrate deploy   (run in seed.sh / CI)
 *   Studio:     npx prisma studio           (GUI browser for the DB)
 *
 * SCHEMA: prisma/schema.prisma
 * MIGRATION FILES: prisma/migrations/
 */
import { PrismaClient } from '@prisma/client'

// Extend globalThis to hold the singleton across hot-reloads in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging: useful during local development to see generated SQL
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Persist the instance across hot-reloads only in non-production environments
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
