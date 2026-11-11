import "dotenv/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    // Migration dùng kết nối trực tiếp (Neon: chuỗi non-pooled)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
