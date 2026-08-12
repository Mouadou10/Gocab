import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma v7 configuration for SQLite.
 */
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: "file:./dev.db",
  },
});
