/**
 * Báo cáo, xử phạt, hàng đợi biên tập viên (DATA_MODEL mục 4).
 * Thu hồi level luôn đi qua finalizeProof({ revoke }) (D40).
 */
import type { AppealStatus, ReportReason, ReportStatus, ReportTarget, SanctionKind } from "@skillverse/db";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { loadLevelTitles, milestoneLabel } from "./milestones";
import { assignReviewers, finalizeProof, type FinalizeProofResult } from "./proofs";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Xử phạt đang hiệu lực
// ---------------------------------------------------------------------------

export async function activeSanctionKinds(db: Db, userId: string, now: Date = new Date()): Promise<Set<SanctionKind>> {
  const rows = await db.sanction.findMany({
    where: { userId, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }], kind: { not: "level_revoked" } },
    select: { kind: true },
  });
  return new Set(rows.map((r) => r.kind));
}

/** Chặn người bị khóa / suspension / post_ban đăng nội dung (bài, bình luận, tin nhắn). */
export async function assertCanPost(db: Db, userId: string, now: Date = new Date()): Promise<void> {
  const u = await db.user.findFirst({ where: { id: userId, deletedAt: null }, select: { status: true } });
  if (!u) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
  if (u.status === "banned") throw new DomainError("FORBIDDEN", "Tài khoản đã bị khóa.");
  const kinds = await activeSanctionKinds(db, userId, now);
  if (kinds.has("suspension")) throw new DomainError("FORBIDDEN", "Tài khoản đang bị tạm ngưng.");
  if (kinds.has("post_ban")) throw new DomainError("FORBIDDEN", "Bạn đang bị cấm đăng nội dung.");
}

async function assertEditor(db: Db, userId: string): Promise<void> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { isEditor: true, deletedAt: true } });
  if (!u?.isEditor || u.deletedAt) throw new DomainError("FORBIDDEN", "Chỉ biên tập viên được thực hiện.");
}

async function notifyEditors(db: Db, kind: string, refType: string, refId: string, now: Date) {
  const editors = await db.user.findMany({ where: { isEditor: true, deletedAt: null, status: "active" }, select: { id: true } });
  if (editors.length > 0) {
    await db.notification.createMany({ data: editors.map((e) => ({ userId: e.id, kind, refType, refId, createdAt: now })) });
  }
}

// ---------------------------------------------------------------------------
// Báo cáo
// ---------------------------------------------------------------------------

/** Tìm chủ sở hữu của đối tượng bị báo cáo (null với skill). NOT_FOUND nếu không tồn tại. */
async function targetOwner(db: Db, type: ReportTarget, id: string): Promise<string | null> {
  switch (type) {
    case "proof": {
      const r = await db.proof.findFirst({ where: { id, deletedAt: null }, select: { userId: true } });
      if (!r) break;
      return r.userId;
    }
    case "user": {
      const r = await db.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!r) break;
      return r.id;
    }
    case "review": {
      const r = await db.review.findUnique({ where: { id }, select: { reviewerId: true } });
      if (!r) break;
      return r.reviewerId;
    }
    case "post": {
      const r = await db.post.findFirst({ where: { id, deletedAt: null }, select: { authorId: true } });
      if (!r) break;
      return r.authorId;
    }
    case "skill": {
      const r = await db.skill.findUnique({ where: { id }, select: { id: true } });
      if (!r) break;
      return null;
    }
  }
  throw new DomainError("NOT_FOUND", "Không tìm thấy nội dung bị báo cáo.");
}

export async function createReport(
  db: Db,
  p: {
    reporterId: string;
    targetType: ReportTarget;
    targetId: string;
    reason: ReportReason;
    details?: string | null;
    evidenceUrl?: string | null;
    now?: Date;
  },
): Promise<{ reportId: string }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const owner = await targetOwner(tx, p.targetType, p.targetId);
    if (owner === p.reporterId) throw new DomainError("BAD_REQUEST", "Không thể tự báo cáo nội dung của mình.");
    const dup = await tx.report.count({
      where: { reporterId: p.reporterId, targetType: p.targetType, targetId: p.targetId, status: { in: ["open", "investigating"] } },
    });
    if (dup > 0) throw new DomainError("CONFLICT", "Bạn đã báo cáo nội dung này.");
    const r = await tx.report.create({
      data: {
        reporterId: p.reporterId,
        targetType: p.targetType,
        targetId: p.targetId,
        reason: p.reason,
        details: p.details?.trim() || null,
        evidenceUrl: p.evidenceUrl ?? null,
        createdAt: now,
      },
    });
    await notifyEditors(tx, "report_filed", "report", r.id, now);
    return { reportId: r.id };
  });
}

export type ReportListItem = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  evidenceUrl: string | null;
  status: ReportStatus;
  outcome: string | null;
  createdAt: Date;
  reporter: { handle: string; displayName: string };
  /** Số báo cáo đang mở trên cùng đối tượng. */
  openReportsOnTarget: number;
  /** Mô tả ngắn đối tượng cho biên tập viên. */
  target: {
    /** Id người sở hữu đối tượng (người nộp / tác giả / người duyệt / chính người bị báo cáo) — để xử phạt. */
    ownerId: string | null;
    ownerHandle: string | null;
    title: string;
    proofStatus?: string;
    /** Chỉ với bằng chứng: cấp + tên mốc. */
    targetLevel?: number;
    levelTitle?: string | null;
  };
};

export async function listReports(
  db: Db,
  p: { editorId: string; status?: ReportStatus | ReportStatus[]; limit?: number; cursor?: string | null },
): Promise<{ items: ReportListItem[]; nextCursor: string | null }> {
  await assertEditor(db, p.editorId);
  const statuses = p.status ? (Array.isArray(p.status) ? p.status : [p.status]) : (["open", "investigating"] as ReportStatus[]);
  const limit = p.limit ?? 20;
  const rows = await db.report.findMany({
    where: { status: { in: statuses } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    include: { reporter: { select: { handle: true, displayName: true } } },
  });
  const page = rows.slice(0, limit);
  const items: ReportListItem[] = [];
  for (const r of page) {
    const open = await db.report.count({
      where: { targetType: r.targetType, targetId: r.targetId, status: { in: ["open", "investigating"] } },
    });
    items.push({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      evidenceUrl: r.evidenceUrl,
      status: r.status,
      outcome: r.outcome,
      createdAt: r.createdAt,
      reporter: r.reporter,
      openReportsOnTarget: open,
      target: await describeTarget(db, r.targetType, r.targetId),
    });
  }
  return { items, nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null };
}

async function describeTarget(db: Db, type: ReportTarget, id: string): Promise<ReportListItem["target"]> {
  switch (type) {
    case "proof": {
      const p = await db.proof.findUnique({
        where: { id },
        select: { skillId: true, targetLevel: true, status: true, user: { select: { id: true, handle: true } }, skill: { select: { name: true } } },
      });
      if (!p) return { ownerId: null, ownerHandle: null, title: "(không còn)" };
      const levelTitle = (await loadLevelTitles(db, [p.skillId]))(p.skillId, p.targetLevel);
      return {
        ownerId: p.user.id,
        ownerHandle: p.user.handle,
        title: `${p.skill.name}: ${milestoneLabel(levelTitle, p.targetLevel)}`,
        proofStatus: p.status,
        targetLevel: p.targetLevel,
        levelTitle,
      };
    }
    case "user": {
      const u = await db.user.findUnique({ where: { id }, select: { id: true, handle: true, displayName: true } });
      return { ownerId: u?.id ?? null, ownerHandle: u?.handle ?? null, title: u?.displayName ?? "(không còn)" };
    }
    case "post": {
      const p = await db.post.findUnique({ where: { id }, select: { body: true, author: { select: { id: true, handle: true } } } });
      return { ownerId: p?.author.id ?? null, ownerHandle: p?.author.handle ?? null, title: (p?.body ?? "").slice(0, 120) };
    }
    case "review": {
      const r = await db.review.findUnique({ where: { id }, select: { verdict: true, comment: true, reviewer: { select: { id: true, handle: true } } } });
      return { ownerId: r?.reviewer.id ?? null, ownerHandle: r?.reviewer.handle ?? null, title: r ? `Phiếu ${r.verdict === "pass" ? "đạt" : "chưa đạt"}${r.comment ? `: ${r.comment.slice(0, 80)}` : ""}` : "(không còn)" };
    }
    case "skill": {
      const s = await db.skill.findUnique({ where: { id }, select: { name: true } });
      return { ownerId: null, ownerHandle: null, title: s?.name ?? "(không còn)" };
    }
  }
}

export type ResolveReportResult = {
  reportId: string;
  status: "confirmed" | "dismissed";
  /** Kết quả finalizeProof khi thu hồi level (bằng chứng đã đạt). */
  revoke: FinalizeProofResult | null;
  /** Hành động tự động khác: proof_removed (đang duyệt) / post_hidden. */
  action: "level_revoked" | "proof_removed" | "post_hidden" | null;
};

/**
 * Biên tập viên xử lý báo cáo. confirmed:
 * - proof đã đạt → thu hồi qua finalizeProof({ revoke }) (sanction level_revoked, level −, XP âm, −15 uy tín người duyệt đạt);
 * - proof đang duyệt/chờ → status removed, phân công còn treo → recused;
 * - post → ẩn (deleted_at).
 * Mọi báo cáo đang mở khác trên cùng đối tượng được đóng cùng kết luận. Không xóa bản ghi nào.
 */
export async function resolveReport(
  db: Db,
  p: { reportId: string; editorId: string; decision: "confirmed" | "dismissed"; outcome?: string | null; now?: Date },
): Promise<ResolveReportResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await assertEditor(tx, p.editorId);
    const report = await tx.report.findUnique({ where: { id: p.reportId } });
    if (!report) throw new DomainError("NOT_FOUND", "Không tìm thấy báo cáo.");
    if (report.status !== "open" && report.status !== "investigating") throw new DomainError("CONFLICT", "Báo cáo đã được xử lý.");

    let revoke: FinalizeProofResult | null = null;
    let action: ResolveReportResult["action"] = null;
    if (p.decision === "confirmed") {
      if (report.targetType === "proof") {
        const proof = await tx.proof.findUnique({ where: { id: report.targetId }, select: { status: true, userId: true } });
        if (proof?.userId === p.editorId) throw new DomainError("FORBIDDEN", "Không tự xử lý báo cáo về mình.");
        if (proof?.status === "passed") {
          revoke = await finalizeProof(tx, {
            proofId: report.targetId,
            now,
            revoke: { byUserId: p.editorId, reason: p.outcome?.trim() || `Báo cáo xác nhận: ${report.reason}`, reportId: report.id },
          });
          action = "level_revoked";
        } else if (proof && ["pending", "in_review", "disputed"].includes(proof.status)) {
          await tx.proof.update({ where: { id: report.targetId }, data: { status: "removed", decidedAt: now } });
          await tx.reviewAssignment.updateMany({ where: { proofId: report.targetId, state: "assigned" }, data: { state: "recused" } });
          await tx.notification.create({
            data: { userId: proof.userId, kind: "proof_removed", refType: "proof", refId: report.targetId, createdAt: now },
          });
          action = "proof_removed";
        }
      } else if (report.targetType === "post") {
        const r = await tx.post.updateMany({ where: { id: report.targetId, deletedAt: null }, data: { deletedAt: now } });
        if (r.count > 0) action = "post_hidden";
      }
    }

    await tx.report.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: { in: ["open", "investigating"] } },
      data: { status: p.decision, handledBy: p.editorId, outcome: p.outcome?.trim() || null },
    });
    await tx.notification.create({
      data: { userId: report.reporterId, kind: `report_${p.decision}`, refType: "report", refId: report.id, createdAt: now },
    });
    return { reportId: report.id, status: p.decision, revoke, action };
  });
}

// ---------------------------------------------------------------------------
// Xử phạt
// ---------------------------------------------------------------------------

export async function sanctionUser(
  db: Db,
  p: {
    editorId: string;
    userId: string;
    kind: "warning" | "review_ban" | "post_ban" | "suspension";
    reason: string;
    /** Số ngày hiệu lực; bỏ trống = vô thời hạn (warning luôn không có hạn). */
    durationDays?: number | null;
    reportId?: string | null;
    now?: Date;
  },
): Promise<{ sanctionId: string; endsAt: Date | null }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await assertEditor(tx, p.editorId);
    if (p.userId === p.editorId) throw new DomainError("BAD_REQUEST", "Không tự xử phạt mình.");
    const target = await tx.user.findFirst({ where: { id: p.userId, deletedAt: null }, select: { id: true } });
    if (!target) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
    if (!p.reason.trim()) throw new DomainError("BAD_REQUEST", "Cần nêu lý do.");
    if (p.durationDays != null && !(p.durationDays > 0)) throw new DomainError("BAD_REQUEST", "Thời hạn không hợp lệ.");
    const endsAt = p.kind === "warning" || p.durationDays == null ? null : new Date(now.getTime() + p.durationDays * DAY_MS);
    const s = await tx.sanction.create({
      data: {
        userId: p.userId,
        kind: p.kind,
        reason: p.reason.trim(),
        reportId: p.reportId ?? null,
        startsAt: now,
        endsAt,
        createdBy: p.editorId,
      },
    });
    if (p.kind === "review_ban") {
      // Gỡ các lượt duyệt đang chờ để bằng chứng được gán người khác.
      const open = await tx.reviewAssignment.findMany({ where: { reviewerId: p.userId, state: "assigned" }, select: { id: true, proofId: true } });
      if (open.length > 0) {
        await tx.reviewAssignment.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { state: "recused" } });
        for (const proofId of new Set(open.map((o) => o.proofId))) {
          const pr = await tx.proof.findUnique({ where: { id: proofId }, select: { status: true } });
          if (pr?.status === "in_review") await assignReviewers(tx, { proofId, now });
        }
      }
    }
    await tx.notification.create({
      data: { userId: p.userId, kind: `sanction_${p.kind}`, refType: "sanction", refId: s.id, createdAt: now },
    });
    return { sanctionId: s.id, endsAt };
  });
}

export async function listUserSanctions(
  db: Db,
  p: { editorId: string; userId: string },
): Promise<{ id: string; kind: SanctionKind; reason: string; startsAt: Date; endsAt: Date | null; proofId: string | null }[]> {
  await assertEditor(db, p.editorId);
  return db.sanction.findMany({
    where: { userId: p.userId },
    orderBy: { startsAt: "desc" },
    select: { id: true, kind: true, reason: true, startsAt: true, endsAt: true, proofId: true },
  });
}

// ---------------------------------------------------------------------------
// Hàng đợi biên tập viên: bằng chứng trùng hash (disputed) + kháng nghị
// ---------------------------------------------------------------------------

export async function listDisputedProofs(db: Db, p: { editorId: string; limit?: number }) {
  await assertEditor(db, p.editorId);
  const rows = await db.proof.findMany({
    where: { status: "disputed", deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: p.limit ?? 50,
    select: {
      id: true,
      skillId: true,
      targetLevel: true,
      mediaUrl: true,
      mediaHash: true,
      createdAt: true,
      user: { select: { handle: true, displayName: true } },
      skill: { select: { slug: true, name: true } },
      fraudSignals: { select: { signal: true, score: true, createdAt: true } },
    },
  });
  const titleOf = await loadLevelTitles(
    db,
    rows.map((r) => r.skillId),
  );
  const out = [];
  for (const r of rows) {
    const matches = await db.proof.findMany({
      where: { mediaHash: r.mediaHash, id: { not: r.id } },
      select: { id: true, status: true, createdAt: true, user: { select: { handle: true } }, skill: { select: { name: true } } },
    });
    out.push({
      proofId: r.id,
      targetLevel: r.targetLevel,
      levelTitle: titleOf(r.skillId, r.targetLevel),
      mediaKey: r.mediaUrl,
      createdAt: r.createdAt,
      user: r.user,
      skill: r.skill,
      signals: r.fraudSignals.map((s) => ({ signal: s.signal, score: s.score.toNumber(), createdAt: s.createdAt })),
      matches: matches.map((m) => ({ proofId: m.id, status: m.status, createdAt: m.createdAt, userHandle: m.user.handle, skillName: m.skill.name })),
    });
  }
  return out;
}

/** clear → vào vòng duyệt bình thường (phân công); remove → removed + thông báo. */
export async function resolveDisputedProof(
  db: Db,
  p: { proofId: string; editorId: string; decision: "clear" | "remove"; now?: Date; rng?: () => number },
): Promise<{ proofId: string; status: "pending" | "in_review" | "removed"; assignedReviewerIds: string[] }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await assertEditor(tx, p.editorId);
    const proof = await tx.proof.findUnique({ where: { id: p.proofId }, select: { status: true, userId: true } });
    if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy bằng chứng.");
    if (proof.status !== "disputed") throw new DomainError("CONFLICT", "Bằng chứng không ở hàng đợi biên tập.");
    if (proof.userId === p.editorId) throw new DomainError("FORBIDDEN", "Không tự xử lý bằng chứng của mình.");
    if (p.decision === "remove") {
      await tx.proof.update({ where: { id: p.proofId }, data: { status: "removed", decidedAt: now } });
      await tx.notification.create({ data: { userId: proof.userId, kind: "proof_removed", refType: "proof", refId: p.proofId, createdAt: now } });
      return { proofId: p.proofId, status: "removed", assignedReviewerIds: [] };
    }
    await tx.proof.update({ where: { id: p.proofId }, data: { status: "pending" } });
    const r = await assignReviewers(tx, { proofId: p.proofId, now, rng: p.rng });
    await tx.notification.create({ data: { userId: proof.userId, kind: "proof_cleared", refType: "proof", refId: p.proofId, createdAt: now } });
    return { proofId: p.proofId, status: r.assignedReviewerIds.length > 0 ? "in_review" : "pending", assignedReviewerIds: r.assignedReviewerIds };
  });
}

export async function listAppeals(db: Db, p: { editorId: string; status?: AppealStatus }) {
  await assertEditor(db, p.editorId);
  const rows = await db.appeal.findMany({
    where: { status: p.status ?? "open" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      user: { select: { handle: true, displayName: true } },
      proof: {
        select: {
          id: true,
          skillId: true,
          targetLevel: true,
          mediaUrl: true,
          decidedAt: true,
          skill: { select: { slug: true, name: true } },
          reviews: { where: { assignment: { state: "done" } }, select: { verdict: true, comment: true } },
        },
      },
    },
  });
  const titleOf = await loadLevelTitles(
    db,
    rows.map((a) => a.proof.skillId),
  );
  return rows.map((a) => ({
    appealId: a.id,
    reason: a.reason,
    status: a.status,
    createdAt: a.createdAt,
    user: a.user,
    proof: {
      proofId: a.proof.id,
      targetLevel: a.proof.targetLevel,
      levelTitle: titleOf(a.proof.skillId, a.proof.targetLevel),
      mediaKey: a.proof.mediaUrl,
      decidedAt: a.proof.decidedAt,
      skill: a.proof.skill,
      passVotes: a.proof.reviews.filter((r) => r.verdict === "pass").length,
      totalVotes: a.proof.reviews.length,
      comments: a.proof.reviews.flatMap((r) => (r.comment ? [r.comment] : [])),
    },
  }));
}
