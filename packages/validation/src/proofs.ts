import { z } from "zod";

/**
 * proof.submit (giai đoạn 2). Client gửi khóa object đã tải lên kho (không gửi hash):
 * server tự tính SHA-256 của file rồi gọi domain `submitProof`.
 * Giới hạn dung lượng/thời lượng kiểm tra ở server theo app_config.media_limits.
 */
export const submitProofInput = z.object({
  skillId: z.uuid(),
  targetLevel: z.number().int().min(1).max(20),
  mediaKey: z.string().min(1).max(512),
  durationS: z.number().int().min(1).max(3600).optional(),
  capturedAt: z.coerce.date().optional(),
  caption: z.string().trim().max(500, "Mô tả tối đa 500 ký tự").optional(),
  safetyAck: z.boolean().default(false),
});
export type SubmitProofInput = z.infer<typeof submitProofInput>;

/** SHA-256 dạng hex chữ thường (DECISIONS D20). */
export const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, "Hash không hợp lệ");
