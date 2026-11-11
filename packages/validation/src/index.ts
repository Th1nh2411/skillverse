/**
 * Zod schema dùng chung cho input/output của API (web + mobile sau này).
 * Sở hữu: đồng đội "domain". Khi đổi schema → báo ngay cho "api" và "ui".
 */
import { z } from "zod";

export const uuid = z.uuid();
export const handle = z.string().regex(/^[a-z0-9_]{3,30}$/, "Tên người dùng chỉ gồm chữ thường, số, gạch dưới (3–30 ký tự)");
export const slug = z.string().regex(/^[a-z0-9-]{2,80}$/);

export const paginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type PaginationInput = z.infer<typeof paginationInput>;

export { z };
