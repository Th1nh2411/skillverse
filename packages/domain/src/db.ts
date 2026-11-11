import type { PrismaClient, Tx } from "@skillverse/db";

/** Mọi hàm domain nhận `db` là PrismaClient hoặc client transaction (Tx). */
export type Db = PrismaClient | Tx;

/**
 * Chạy `fn` trong một transaction. Nếu `db` đã là client transaction (không có `$transaction`)
 * thì chạy thẳng trên nó — transaction ngoài sẽ bao trọn.
 */
export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const maybe = db as Partial<PrismaClient>;
  if (typeof maybe.$transaction === "function") {
    return (db as PrismaClient).$transaction((tx) => fn(tx), { timeout: 20000 });
  }
  return fn(db);
}
