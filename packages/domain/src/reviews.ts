/**
 * Phía người duyệt: chấm phiếu, báo cáo trong lúc duyệt, hàng đợi và màn duyệt.
 * Người nộp LUÔN ẩn danh với người duyệt: không trả user id / handle / tên / proofId — chỉ mã ẩn danh.
 */
import { createHash } from "node:crypto";
import type { CriterionKind, ReportReason, ReviewVerdict, RiskLevel } from "@skillverse/db";
import { getConfig } from "./config";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { awardXp, bumpDailyQuest } from "./ledger";
import { finalizeProof, type FinalizeProofResult } from "./proofs";

/** Mã ẩn danh ổn định theo bằng chứng, không suy ngược được người nộp (vd. "#A7F2"). */
export function anonymousCode(proofId: string): string {
  return "#" + createHash("sha256").update(`anon:${proofId}`).digest("hex").slice(0, 4).toUpperCase();
}

const REVIEW_QUEST_KEY = "review_2";

// ---------------------------------------------------------------------------
// submitReview
// ---------------------------------------------------------------------------

export type SubmitReviewParams = {
  assignmentId: string;
  reviewerId: string;
  verdict: ReviewVerdict;
  /** Một dấu cho MỖI tiêu chí của đúng criteria_version của bằng chứng. */
  marks: { criterionId: string; met: boolean }[];
  comment?: string | null;
  now?: Date;
  rng?: () => number;
};

export type SubmitReviewResult = {
  reviewId: string;
  xpAwarded: number;
  quest: { progress: number; target: number; completed: boolean; xpAwarded: number } | null;
  /** Kết quả gọi finalizeProof ngay sau phiếu (waiting / tie / passed / failed ...). */
  finalize: FinalizeProofResult;
};

/**
 * Ghi phiếu duyệt (một transaction): kiểm tra quyền + trạng thái phân công + đủ dấu tiêu chí,
 * verdict nhất quán (pass ⇔ mọi tiêu chí đạt), XP review_done, nhiệm vụ ngày review_2, rồi gọi finalizeProof.
 */
export async function submitReview(db: Db, p: SubmitReviewParams): Promise<SubmitReviewResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const a0 = await tx.reviewAssignment.findUnique({ where: { id: p.assignmentId }, select: { proofId: true } });
    if (!a0) throw new DomainError("NOT_FOUND", "Không tìm thấy lượt duyệt.");
    // Khóa bằng chứng trước (cùng thứ tự khóa với finalizeProof → tránh deadlock khi nhiều người chấm cùng lúc).
    await tx.$queryRaw`SELECT id FROM proofs WHERE id = ${a0.proofId}::uuid FOR NO KEY UPDATE`;
    const a = await tx.reviewAssignment.findUniqueOrThrow({
      where: { id: p.assignmentId },
      include: {
        proof: {
          select: {
            id: true,
            status: true,
            criteriaVersion: { select: { criteria: { select: { id: true } } } },
          },
        },
      },
    });
    if (a.reviewerId !== p.reviewerId) throw new DomainError("FORBIDDEN", "Bạn không được phân công duyệt bằng chứng này.");
    if (a.state !== "assigned") throw new DomainError("CONFLICT", "Lượt duyệt này đã đóng.");
    if (a.dueAt.getTime() < now.getTime()) throw new DomainError("PRECONDITION_FAILED", "Lượt duyệt đã quá hạn.");
    if (a.proof.status !== "in_review") throw new DomainError("CONFLICT", "Bằng chứng không còn trong vòng duyệt.");

    const expected = new Set(a.proof.criteriaVersion.criteria.map((c) => c.id));
    const given = new Set(p.marks.map((m) => m.criterionId));
    if (given.size !== p.marks.length || given.size !== expected.size || [...given].some((id) => !expected.has(id))) {
      throw new DomainError("BAD_REQUEST", "Cần chấm đủ và đúng từng tiêu chí.");
    }
    const allMet = p.marks.every((m) => m.met);
    if ((p.verdict === "pass") !== allMet) {
      throw new DomainError(
        "BAD_REQUEST",
        p.verdict === "pass" ? "Chỉ xác nhận đạt khi mọi tiêu chí đều đạt." : "Chọn ít nhất một tiêu chí chưa đạt.",
      );
    }

    const review = await tx.review.create({
      data: {
        assignmentId: a.id,
        proofId: a.proofId,
        reviewerId: p.reviewerId,
        verdict: p.verdict,
        comment: p.comment?.trim() || null,
        createdAt: now,
        reviewMarks: { create: p.marks.map((m) => ({ criterionId: m.criterionId, met: m.met })) },
      },
    });
    await tx.reviewAssignment.update({ where: { id: a.id }, data: { state: "done" } });

    const rewards = await getConfig<{ review_done: number }>(tx, "xp_rewards");
    await awardXp(tx, {
      userId: p.reviewerId,
      amount: rewards.review_done,
      reason: "review_done",
      refType: "review",
      refId: review.id,
      now,
    });
    const quest = await bumpDailyQuest(tx, { userId: p.reviewerId, questKey: REVIEW_QUEST_KEY, now });

    const finalize = await finalizeProof(tx, { proofId: a.proofId, now, rng: p.rng });
    return { reviewId: review.id, xpAwarded: rewards.review_done, quest, finalize };
  });
}

// ---------------------------------------------------------------------------
// reportProofDuringReview
// ---------------------------------------------------------------------------

/** Người duyệt báo cáo gian lận bằng chứng mình được phân công (qua assignmentId — không lộ proofId). */
export async function reportProofDuringReview(
  db: Db,
  p: { assignmentId: string; reviewerId: string; reason: ReportReason; details?: string | null; now?: Date },
): Promise<{ reportId: string }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const a = await tx.reviewAssignment.findUnique({ where: { id: p.assignmentId } });
    if (!a) throw new DomainError("NOT_FOUND", "Không tìm thấy lượt duyệt.");
    if (a.reviewerId !== p.reviewerId) throw new DomainError("FORBIDDEN", "Bạn không được phân công duyệt bằng chứng này.");
    const dup = await tx.report.count({
      where: { reporterId: p.reviewerId, targetType: "proof", targetId: a.proofId, status: { in: ["open", "investigating"] } },
    });
    if (dup > 0) throw new DomainError("CONFLICT", "Bạn đã báo cáo bằng chứng này.");
    const r = await tx.report.create({
      data: {
        reporterId: p.reviewerId,
        targetType: "proof",
        targetId: a.proofId,
        reason: p.reason,
        details: p.details?.trim() || null,
        createdAt: now,
      },
    });
    const editors = await tx.user.findMany({ where: { isEditor: true, deletedAt: null, status: "active" }, select: { id: true } });
    if (editors.length > 0) {
      await tx.notification.createMany({
        data: editors.map((e) => ({ userId: e.id, kind: "report_filed", refType: "report", refId: r.id, createdAt: now })),
      });
    }
    return { reportId: r.id };
  });
}

// ---------------------------------------------------------------------------
// Truy vấn phía người duyệt (ẩn danh người nộp)
// ---------------------------------------------------------------------------

export type ReviewQueueItem = {
  assignmentId: string;
  anonymousCode: string;
  skill: { slug: string; name: string; riskLevel: RiskLevel };
  targetLevel: number;
  durationS: number | null;
  assignedAt: Date;
  dueAt: Date;
  votes: number;
  required: number;
  criteriaCount: number;
};

export type ReviewQueue = { reputation: number; items: ReviewQueueItem[] };

/** Các lượt duyệt đang chờ của người duyệt (state = assigned, chưa quá hạn), hạn gần nhất trước. */
export async function getReviewQueue(db: Db, p: { reviewerId: string; now?: Date }): Promise<ReviewQueue> {
  const now = p.now ?? new Date();
  const me = await db.user.findUnique({ where: { id: p.reviewerId }, select: { reputation: true } });
  if (!me) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
  const rows = await db.reviewAssignment.findMany({
    where: { reviewerId: p.reviewerId, state: "assigned", dueAt: { gte: now }, proof: { status: "in_review", deletedAt: null } },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      assignedAt: true,
      dueAt: true,
      proof: {
        select: {
          id: true,
          targetLevel: true,
          durationS: true,
          skillId: true,
          skill: { select: { slug: true, name: true, riskLevel: true } },
          criteriaVersion: { select: { _count: { select: { criteria: true } } } },
          reviewAssignments: { where: { state: "done" }, select: { id: true } },
        },
      },
    },
  });
  const levels = rows.length
    ? await db.skillLevel.findMany({
        where: { OR: rows.map((r) => ({ skillId: r.proof.skillId, level: r.proof.targetLevel })) },
        select: { skillId: true, level: true, minReviewers: true },
      })
    : [];
  const minRev = (skillId: string, level: number) =>
    levels.find((l) => l.skillId === skillId && l.level === level)?.minReviewers ?? 0;
  return {
    reputation: me.reputation,
    items: rows.map((r) => ({
      assignmentId: r.id,
      anonymousCode: anonymousCode(r.proof.id),
      skill: r.proof.skill,
      targetLevel: r.proof.targetLevel,
      durationS: r.proof.durationS,
      assignedAt: r.assignedAt,
      dueAt: r.dueAt,
      votes: r.proof.reviewAssignments.length,
      required: minRev(r.proof.skillId, r.proof.targetLevel),
      criteriaCount: r.proof.criteriaVersion._count.criteria,
    })),
  };
}

export type ReviewTask = {
  assignmentId: string;
  state: "assigned" | "done" | "expired" | "recused";
  /** true khi còn chấm được (assigned, chưa quá hạn, bằng chứng còn đang duyệt). */
  canSubmit: boolean;
  dueAt: Date;
  anonymousCode: string;
  reviewerReputation: number;
  skill: { slug: string; name: string; riskLevel: RiskLevel };
  targetLevel: number;
  levelTitle: string | null;
  votes: number;
  required: number;
  /** Khóa object video trong kho — api đổi thành URL ký có hạn. Không phải URL công khai. */
  mediaKey: string;
  durationS: number | null;
  capturedAt: Date | null;
  submittedAt: Date;
  caption: string | null;
  safetyAck: boolean;
  aiPrecheck: unknown;
  criteria: { id: string; position: number; text: string; kind: CriterionKind; threshold: number | null }[];
  myReview: { verdict: ReviewVerdict; comment: string | null; marks: { criterionId: string; met: boolean }[] } | null;
  /** Người xem đã báo cáo bằng chứng này chưa. */
  reported: boolean;
};

/** Màn duyệt một bằng chứng. Chỉ chính người được phân công xem được. Ẩn danh người nộp. */
export async function getReviewTask(
  db: Db,
  p: { assignmentId: string; reviewerId: string; now?: Date },
): Promise<ReviewTask> {
  const now = p.now ?? new Date();
  const a = await db.reviewAssignment.findUnique({
    where: { id: p.assignmentId },
    select: {
      id: true,
      reviewerId: true,
      state: true,
      dueAt: true,
      reviewer: { select: { reputation: true } },
      review: { select: { verdict: true, comment: true, reviewMarks: { select: { criterionId: true, met: true } } } },
      proof: {
        select: {
          id: true,
          status: true,
          skillId: true,
          targetLevel: true,
          mediaUrl: true,
          durationS: true,
          capturedAt: true,
          createdAt: true,
          caption: true,
          safetyAck: true,
          aiPrecheck: true,
          skill: { select: { slug: true, name: true, riskLevel: true } },
          criteriaVersion: { select: { criteria: { orderBy: { position: "asc" } } } },
          reviewAssignments: { where: { state: "done" }, select: { id: true } },
        },
      },
    },
  });
  if (!a) throw new DomainError("NOT_FOUND", "Không tìm thấy lượt duyệt.");
  if (a.reviewerId !== p.reviewerId) throw new DomainError("FORBIDDEN", "Bạn không được phân công duyệt bằng chứng này.");
  const level = await db.skillLevel.findUnique({
    where: { skillId_level: { skillId: a.proof.skillId, level: a.proof.targetLevel } },
    select: { title: true, minReviewers: true },
  });
  const reported =
    (await db.report.count({ where: { reporterId: p.reviewerId, targetType: "proof", targetId: a.proof.id } })) > 0;
  return {
    assignmentId: a.id,
    state: a.state,
    canSubmit: a.state === "assigned" && a.dueAt.getTime() >= now.getTime() && a.proof.status === "in_review",
    dueAt: a.dueAt,
    anonymousCode: anonymousCode(a.proof.id),
    reviewerReputation: a.reviewer.reputation,
    skill: a.proof.skill,
    targetLevel: a.proof.targetLevel,
    levelTitle: level?.title ?? null,
    votes: a.proof.reviewAssignments.length,
    required: level?.minReviewers ?? 0,
    mediaKey: a.proof.mediaUrl,
    durationS: a.proof.durationS,
    capturedAt: a.proof.capturedAt,
    submittedAt: a.proof.createdAt,
    caption: a.proof.caption,
    safetyAck: a.proof.safetyAck,
    aiPrecheck: a.proof.aiPrecheck,
    criteria: a.proof.criteriaVersion.criteria.map((c) => ({
      id: c.id,
      position: c.position,
      text: c.text,
      kind: c.kind,
      threshold: c.threshold ? c.threshold.toNumber() : null,
    })),
    myReview: a.review
      ? { verdict: a.review.verdict, comment: a.review.comment, marks: a.review.reviewMarks }
      : null,
    reported,
  };
}
