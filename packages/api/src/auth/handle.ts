import { randomInt } from "node:crypto";
import type { PrismaClient } from "@skillverse/db";

const HANDLE_MAX = 30;
const HANDLE_MIN = 3;

/** Chuẩn hóa chuỗi bất kỳ (email, tên tiếng Việt) thành gốc handle hợp lệ `^[a-z0-9_]{3,30}$`. */
export function handleBase(source: string): string {
  const base = source
    .split("@")[0]!
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, HANDLE_MAX - 5); // chừa chỗ cho hậu tố "_1234"
  return base.length >= HANDLE_MIN ? base : `nguoidung${base ? `_${base}` : ""}`.slice(0, HANDLE_MAX - 5);
}

/** Sinh handle chưa ai dùng từ email / tên hiển thị. */
export async function generateUniqueHandle(db: PrismaClient, source: string): Promise<string> {
  const base = handleBase(source);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}_${randomInt(1000, 10000)}`;
    const taken = await db.user.findUnique({ where: { handle: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`.slice(0, HANDLE_MAX);
}
