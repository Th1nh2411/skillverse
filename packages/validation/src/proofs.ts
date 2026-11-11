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

/** proof.status / levelUp.summary / share card */
export const proofIdInput = z.object({ proofId: z.uuid() });
export type ProofIdInput = z.infer<typeof proofIdInput>;

/** review.task */
export const reviewTaskInput = z.object({ assignmentId: z.uuid() });
export type ReviewTaskInput = z.infer<typeof reviewTaskInput>;

export const reviewVerdict = z.enum(["pass", "fail"]);

/** review.submit — chấm đủ mọi tiêu chí; verdict "pass" chỉ khi mọi tiêu chí đạt (domain kiểm tra lại). */
export const submitReviewInput = z
  .object({
    assignmentId: z.uuid(),
    verdict: reviewVerdict,
    marks: z
      .array(z.object({ criterionId: z.uuid(), met: z.boolean() }))
      .min(1, "Cần chấm từng tiêu chí")
      .max(30)
      .refine((m) => new Set(m.map((x) => x.criterionId)).size === m.length, "Tiêu chí bị trùng"),
    comment: z.string().trim().max(1000, "Nhận xét tối đa 1000 ký tự").optional(),
  })
  .refine((v) => (v.verdict === "pass") === v.marks.every((m) => m.met), {
    message: "Kết luận không khớp với các tiêu chí đã chấm",
    path: ["verdict"],
  });
export type SubmitReviewInput = z.infer<typeof submitReviewInput>;

/** Lý do báo cáo — trùng enum report_reason trong DB. */
export const reportReason = z.enum(["reused_video", "not_self", "edited", "collusion", "unsafe", "harassment", "other"]);
export type ReportReasonValue = z.infer<typeof reportReason>;

export const REPORT_REASON_LABELS: Record<ReportReasonValue, string> = {
  reused_video: "Video cũ hoặc dùng lại",
  not_self: "Không phải chính người đăng thực hiện",
  edited: "Video bị cắt ghép",
  collusion: "Thông đồng duyệt",
  unsafe: "Không an toàn",
  harassment: "Quấy rối",
  other: "Lý do khác",
};

/** review.report — báo cáo trong lúc duyệt (qua assignmentId, không lộ proofId). */
export const reportDuringReviewInput = z.object({
  assignmentId: z.uuid(),
  reason: reportReason,
  details: z.string().trim().max(1000).optional(),
});
export type ReportDuringReviewInput = z.infer<typeof reportDuringReviewInput>;

/** proof.appeal */
export const fileAppealInput = z.object({
  proofId: z.uuid(),
  reason: z.string().trim().min(10, "Nêu lý do ít nhất 10 ký tự").max(1000, "Tối đa 1000 ký tự"),
});
export type FileAppealInput = z.infer<typeof fileAppealInput>;

/** appeal.resolve (biên tập viên) */
export const resolveAppealInput = z.object({
  appealId: z.uuid(),
  decision: z.enum(["upheld", "overturned"]),
});
export type ResolveAppealInput = z.infer<typeof resolveAppealInput>;
