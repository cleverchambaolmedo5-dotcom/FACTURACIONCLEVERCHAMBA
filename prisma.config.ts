import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by Prisma CLI commands only (migrate, db pull, studio, etc.).
    // Must be a DIRECT (non-pooled) connection: migrations need a
    // session-mode connection, which a transaction-mode pooler (e.g.
    // Supabase's pgbouncer) doesn't provide. The app itself never reads
    // this — at runtime, PrismaClient connects through the `pg` driver
    // adapter configured in `src/lib/prisma.ts`, using DATABASE_URL
    // instead. Locally (Docker Compose) both env vars point at the same
    // instance, since there's no pooler in front of it.
    url: env("DIRECT_URL"),
  },
});
