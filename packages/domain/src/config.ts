import type { Tx, PrismaClient } from "@skillverse/db";

/** Đọc ngưỡng từ bảng app_config. KHÔNG hard-code ngưỡng ở nơi khác. */
export async function getConfig<T>(db: Tx | PrismaClient, key: string): Promise<T> {
  const row = await db.appConfig.findUnique({ where: { key } });
  if (!row) throw new Error(`Thiếu app_config.${key}`);
  return row.value as T;
}
