import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";
export { PrismaClient };

/** Kiểu transaction client (dùng trong prisma.$transaction(async (tx) => ...)). */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL chưa được cấu hình");
  const adapter = new PrismaPg({
    connectionString: url,
    // Pool nhỏ: Vercel serverless mở nhiều instance; Neon pooled (pgbouncer) gánh phần còn lại.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __skillversePrisma?: PrismaClient };

/** Singleton dùng ở server (tránh tạo nhiều pool khi hot-reload). */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__skillversePrisma) {
    globalForPrisma.__skillversePrisma = createPrismaClient();
  }
  return globalForPrisma.__skillversePrisma;
}
