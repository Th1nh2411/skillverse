/** Tạo DB test của api nếu chưa có rồi áp migration (idempotent). */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createPrismaClient } from "@skillverse/db";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Thiếu TEST_DATABASE_URL");
  const target = new URL(url);
  const dbName = target.pathname.replace(/^\//, "");
  if (!/_test($|_)/.test(dbName)) throw new Error(`Từ chối dùng DB không phải *_test: ${dbName}`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const db = createPrismaClient(admin.toString());
  try {
    const rows = await db.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM pg_database WHERE datname = ${dbName}`;
    if (rows.length === 0) await db.$executeRawUnsafe(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
  } finally {
    await db.$disconnect();
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: path.resolve(import.meta.dirname, "../../db"),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "pipe",
  });
}
