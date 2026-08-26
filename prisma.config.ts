import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma v7 configuration for SQLite / LibSQL (Turso).
 * Uses DATABASE_URL env var for both CLI and runtime.
 */
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL || "file:./dev.db",
  },
});
