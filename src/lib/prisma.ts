import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Prisma 7 requires an explicit driver adapter instead of the bundled
// query engine binary. `@prisma/adapter-pg` talks to any standard
// PostgreSQL instance (local via Docker Compose, Supabase, etc.) over
// the `pg` driver.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Reuse a single PrismaClient instance across hot reloads in development
// to avoid exhausting the Postgres connection pool.
export const prisma = globalThis.prismaGlobal ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
