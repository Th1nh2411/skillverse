/**
 * Kháng nghị (DATA_MODEL mục 3.6, DECISIONS D41): một lần mỗi bằng chứng trượt, trong appeal_window_days.
 * overturned KHÔNG ghi level: mở vòng duyệt mới với người duyệt khác; kết quả vẫn chốt bằng finalizeProof.
 */
import type { AppealStatus } from "@skillverse/db";
import { getConfig } from "./config";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { assignReviewers } from "./proofs";

const DAY_MS = 86_400_000;

export async function fileAppeal(
  db: Db,
  p: { proofId: string; userId: string; reason: string; now?: Date },
): Promise<{ appealId: string }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const proof = await tx.proof.findFirst({ where: { id: p.proofId, deletedAt: null }, include: { appeal: true } });
    if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy bằng chứng.");
    if (proof.userId !== p.userId) throw new DomainError("FORBIDDEN", "Chỉ người nộp được kháng nghị.");
    if (proof.status !== "failed") throw new DomainError("PRECONDITION_FAILED", "Chỉ kháng nghị được bằng chứng chưa đạt.");
    if (proof.appeal) throw new DomainError("CONFLICT", "Mỗi bằng chứng chỉ được kháng nghị một lần.");
    const days = await getConfig<number>(tx, "appeal_window_days");
    if (!proof.decidedAt || now.getTime() - proof.decidedAt.getTime() > days * DAY_MS) {
      throw new DomainError("PRECONDITION_FAILED", `Đã quá ${days} ngày để kháng nghị.`);
    }
    const reason = p.reason.trim();
    if (!reason) throw new DomainError("BAD_REQUEST", "Cần nêu lý do kháng nghị.");
    const appeal = await tx.appeal.create({
      data: { proofId: proof.id, userId: p.userId, reason, createdAt: now },
    });
    const editors = await tx.user.findMany({ where: { isEditor: true, deletedAt: null, status: "active" }, select: { id: true } });
    if (editors.length > 0) {
      await tx.notification.createMany({
        data: editors.map((e) => ({ userId: e.id, kind: "appeal_filed", refType: "appeal", refId: appeal.id, createdAt: now })),
      });
    }
    return { appealId: appeal.id };
  });
}

export type ResolveAppealResult = {
  appealId: string;
  status: Exclude<AppealStatus, "open">;
  /** Người duyệt mới khi overturned. */
  assignedReviewerIds: string[];
  shortfall: number;
};

/**
 * Biên tập viên xử lý kháng nghị.
 * - upheld: giữ kết quả trượt.
 * - overturned: phân công vòng cũ chuyển `recused` (phiếu vẫn lưu, không tính lại), bằng chứng về `in_review`,
 *   gán min_reviewers người MỚI (assignReviewers loại mọi người đã từng được phân công bằng chứng này).
 */
export async function resolveAppeal(
  db: Db,
  p: { appealId: string; editorId: string; decision: "upheld" | "overturned"; now?: Date; rng?: () => number },
): Promise<ResolveAppealResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const editor = await tx.user.findUnique({ where: { id: p.editorId }, select: { isEditor: true } });
    if (!editor?.isEditor) throw new DomainError("FORBIDDEN", "Chỉ biên tập viên được xử lý kháng nghị.");
    const appeal = await tx.appeal.findUnique({ where: { id: p.appealId }, include: { proof: true } });
    if (!appeal) throw new DomainError("NOT_FOUND", "Không tìm thấy kháng nghị.");
    if (appeal.status !== "open") throw new DomainError("CONFLICT", "Kháng nghị đã được xử lý.");
    if (appeal.proof.userId === p.editorId) throw new DomainError("FORBIDDEN", "Không tự xử lý kháng nghị của mình.");

    await tx.appeal.update({ where: { id: appeal.id }, data: { status: p.decision, resolvedBy: p.editorId } });
    let assigned = { assignedReviewerIds: [] as string[], shortfall: 0 };
    if (p.decision === "overturned") {
      await tx.reviewAssignment.updateMany({ where: { proofId: appeal.proofId }, data: { state: "recused" } });
      await tx.proof.update({ where: { id: appeal.proofId }, data: { status: "in_review", decidedAt: null } });
      assigned = await assignReviewers(tx, { proofId: appeal.proofId, now, rng: p.rng });
    }
    await tx.notification.create({
      data: { userId: appeal.userId, kind: `appeal_${p.decision}`, refType: "proof", refId: appeal.proofId, createdAt: now },
    });
    return { appealId: appeal.id, status: p.decision, ...assigned };
  });
}
