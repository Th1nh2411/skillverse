/**
 * Lõi vòng xác thực (DATA_MODEL mục 3–5): nộp bằng chứng, phân công người duyệt, chốt kết quả.
 *
 * QUY TẮC: `finalizeProof()` là nơi DUY NHẤT trong code ứng dụng ghi `user_skills.level`,
 * và luôn chạy trong MỘT transaction.
 */
import type { Prisma, ProofStatus } from "@skillverse/db";
import { getConfig, getRarityThresholds, type MediaLimits, type ReputationDeltas } from "./config";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { applyReputation, awardXp } from "./ledger";
import { rarityOf } from "./rarity";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Trạng thái bằng chứng còn "mở" — mỗi người chỉ có một bằng chứng mở cho mỗi kỹ năng. */
const OPEN_STATUSES: ProofStatus[] = ["pending", "in_review", "disputed"];
/** Sai số khi so tỉ lệ phiếu với review_pass_ratio (0.667 trong app_config biểu diễn 2/3). */
const RATIO_EPSILON = 0.0005;

// ---------------------------------------------------------------------------
// submitProof
// ---------------------------------------------------------------------------

export type SubmitProofParams = {
  userId: string;
  skillId: string;
  targetLevel: number;
  /** Khóa/URL object trong kho (private). */
  mediaUrl: string;
  /** SHA-256 hex của file (DECISIONS D20), do server tính — không nhận từ client. */
  mediaHash: string;
  durationS?: number | null;
  capturedAt?: Date | null;
  caption?: string | null;
  safetyAck?: boolean;
  /** MIME type của file (kiểm tra theo media_limits.allowed_types). */
  contentType?: string | null;
  /** Kích thước file (byte), kiểm tra theo media_limits.max_mb. */
  sizeBytes?: number | null;
  /** Kết quả AI sơ bộ — chỉ tham khảo. Bỏ trống → dùng bản giả lập `simulateAiPrecheck`. */
  aiPrecheck?: Prisma.InputJsonValue | null;
  now?: Date;
  rng?: () => number;
};

export type AiPrecheck = {
  /** Luôn true: AI chỉ tham khảo, người duyệt quyết định. */
  advisoryOnly: true;
  checks: { key: "duration" | "format" | "size"; ok: boolean | null; detail: string }[];
};

/**
 * Kiểm tra sơ bộ giả lập (MVP chưa có AI): chỉ đối chiếu thời lượng, định dạng, dung lượng với media_limits.
 * `ok = null` khi thiếu dữ liệu.
 */
export function simulateAiPrecheck(
  m: { durationS?: number | null; contentType?: string | null; sizeBytes?: number | null },
  limits: MediaLimits,
): AiPrecheck {
  const mb = m.sizeBytes != null ? m.sizeBytes / (1024 * 1024) : null;
  return {
    advisoryOnly: true,
    checks: [
      {
        key: "duration",
        ok: m.durationS != null ? m.durationS <= limits.max_seconds : null,
        detail: m.durationS != null ? `${m.durationS}/${limits.max_seconds} giây` : "Chưa rõ thời lượng",
      },
      {
        key: "format",
        ok: m.contentType ? limits.allowed_types.includes(m.contentType) : null,
        detail: m.contentType ?? "Chưa rõ định dạng",
      },
      {
        key: "size",
        ok: mb != null ? mb <= limits.max_mb : null,
        detail: mb != null ? `${mb.toFixed(1)}/${limits.max_mb} MB` : "Chưa rõ dung lượng",
      },
    ],
  };
}

export type SubmitProofResult = {
  proofId: string;
  status: ProofStatus;
  /** true khi media_hash trùng bằng chứng khác → `disputed`, vào hàng đợi biên tập viên. */
  duplicate: boolean;
  assignedReviewerIds: string[];
};

/**
 * Nộp bằng chứng. Kiểm tra level == target − 1 và mọi kỹ năng cha đạt required_level.
 * Trùng hash → ghi fraud_signals(duplicate_hash) và đặt `status = disputed` (hàng đợi biên tập viên),
 * không phân công. Ngược lại phân công người duyệt ngay (status → in_review).
 */
export async function submitProof(db: Db, p: SubmitProofParams): Promise<SubmitProofResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const user = await tx.user.findFirst({ where: { id: p.userId, deletedAt: null }, select: { id: true, status: true } });
    if (!user) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
    if (user.status === "banned") throw new DomainError("FORBIDDEN", "Tài khoản đã bị khóa.");

    const skill = await tx.skill.findFirst({
      where: { id: p.skillId, status: "active" },
      include: {
        skillEdgesChildSkill: { include: { parentSkill: { select: { name: true } } } },
        skillLevels: { where: { level: p.targetLevel } },
      },
    });
    if (!skill) throw new DomainError("NOT_FOUND", "Không tìm thấy kỹ năng.");
    if (!Number.isInteger(p.targetLevel) || p.targetLevel < 1 || p.targetLevel > skill.maxLevel) {
      throw new DomainError("BAD_REQUEST", "Cấp mục tiêu không hợp lệ.");
    }
    const level = skill.skillLevels[0];
    if (!level?.currentVersionId) throw new DomainError("PRECONDITION_FAILED", "Cấp này chưa có tiêu chí.");

    if (skill.riskLevel !== "none" && !p.safetyAck) {
      throw new DomainError("BAD_REQUEST", "Cần xác nhận cam kết an toàn cho kỹ năng có rủi ro.");
    }
    const limits = await getConfig<MediaLimits>(tx, "media_limits");
    if (p.durationS != null && p.durationS > limits.max_seconds) {
      throw new DomainError("BAD_REQUEST", `Video dài tối đa ${limits.max_seconds} giây.`);
    }
    if (p.contentType != null && !limits.allowed_types.includes(p.contentType)) {
      throw new DomainError("BAD_REQUEST", "Định dạng video không được hỗ trợ.");
    }
    if (p.sizeBytes != null && p.sizeBytes > limits.max_mb * 1024 * 1024) {
      throw new DomainError("BAD_REQUEST", `Video tối đa ${limits.max_mb} MB.`);
    }

    const parentIds = skill.skillEdgesChildSkill.map((e) => e.parentSkillId);
    const mine = await tx.userSkill.findMany({
      where: { userId: p.userId, skillId: { in: [skill.id, ...parentIds] } },
      select: { skillId: true, level: true },
    });
    const lv = new Map(mine.map((m) => [m.skillId, m.level]));
    const current = lv.get(skill.id) ?? 0;
    if (current !== p.targetLevel - 1) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Bạn đang ở cấp ${current}, chỉ có thể nộp bằng chứng cho cấp ${current + 1}.`,
      );
    }
    const unmet = skill.skillEdgesChildSkill.find((e) => (lv.get(e.parentSkillId) ?? 0) < e.requiredLevel);
    if (unmet) {
      throw new DomainError(
        "PRECONDITION_FAILED",
        `Cần đạt ${unmet.parentSkill.name} cấp ${unmet.requiredLevel} trước.`,
      );
    }

    const open = await tx.proof.count({
      where: { userId: p.userId, skillId: skill.id, status: { in: OPEN_STATUSES }, deletedAt: null },
    });
    if (open > 0) throw new DomainError("CONFLICT", "Bạn đang có bằng chứng chờ duyệt cho kỹ năng này.");

    const dupCount = await tx.proof.count({ where: { mediaHash: p.mediaHash } });
    const duplicate = dupCount > 0;

    const proof = await tx.proof.create({
      data: {
        userId: p.userId,
        skillId: skill.id,
        targetLevel: p.targetLevel,
        criteriaVersionId: level.currentVersionId,
        mediaUrl: p.mediaUrl,
        mediaHash: p.mediaHash,
        durationS: p.durationS ?? null,
        capturedAt: p.capturedAt ?? null,
        caption: p.caption ?? null,
        safetyAck: p.safetyAck ?? false,
        aiPrecheck: p.aiPrecheck ?? (simulateAiPrecheck(p, limits) as unknown as Prisma.InputJsonValue),
        status: duplicate ? "disputed" : "pending",
        createdAt: now,
      },
    });

    if (duplicate) {
      await tx.fraudSignal.create({
        data: { userId: p.userId, proofId: proof.id, signal: "duplicate_hash", score: dupCount, createdAt: now },
      });
      await tx.notification.create({
        data: { userId: p.userId, kind: "proof_editor_review", refType: "proof", refId: proof.id, createdAt: now },
      });
      return { proofId: proof.id, status: "disputed", duplicate: true, assignedReviewerIds: [] };
    }

    const r = await assignReviewers(tx, { proofId: proof.id, now, rng: p.rng });
    return {
      proofId: proof.id,
      status: r.assignedReviewerIds.length > 0 ? "in_review" : "pending",
      duplicate: false,
      assignedReviewerIds: r.assignedReviewerIds,
    };
  });
}

// ---------------------------------------------------------------------------
// assignReviewers
// ---------------------------------------------------------------------------

export type AssignReviewersParams = {
  proofId: string;
  /** Số người cần thêm. Mặc định: min_reviewers − (số phân công assigned + done). */
  count?: number;
  /** Ưu tiên uy tín cao (người phá hòa / bù thiếu). Cấp cao (≥ max_level − 1) luôn ưu tiên. */
  preferHighReputation?: boolean;
  now?: Date;
  rng?: () => number;
};

export type AssignReviewersResult = {
  assignedReviewerIds: string[];
  /** Số người còn thiếu do không đủ ứng viên hợp lệ. */
  shortfall: number;
};

/**
 * Chọn người duyệt theo DATA_MODEL mục 4.
 * Đủ điều kiện: level ≥ min_reviewer_level, không review_ban hiệu lực, reputation ≥ reviewer_min_reputation,
 * tài khoản active. Loại trừ: theo dõi hai chiều, từng skill_swaps, trùng device fingerprint,
 * đã gặp người nộp trong reviewer_exclusion_days ngày, đã được phân công bằng chứng này.
 */
export async function assignReviewers(db: Db, p: AssignReviewersParams): Promise<AssignReviewersResult> {
  const now = p.now ?? new Date();
  const rng = p.rng ?? Math.random;
  return withTx(db, async (tx) => {
    const proof = await tx.proof.findUnique({
      where: { id: p.proofId },
      include: { skill: { select: { id: true, maxLevel: true } }, reviewAssignments: { select: { reviewerId: true, state: true } } },
    });
    if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy bằng chứng.");
    if (!["pending", "in_review"].includes(proof.status)) {
      throw new DomainError("PRECONDITION_FAILED", "Bằng chứng không ở trạng thái chờ duyệt.");
    }
    const level = await tx.skillLevel.findUnique({
      where: { skillId_level: { skillId: proof.skillId, level: proof.targetLevel } },
    });
    if (!level) throw new DomainError("PRECONDITION_FAILED", "Không tìm thấy cấp kỹ năng.");

    const active = proof.reviewAssignments.filter((a) => a.state === "assigned" || a.state === "done").length;
    const need = p.count ?? Math.max(0, level.minReviewers - active);
    if (need <= 0) return { assignedReviewerIds: [], shortfall: 0 };

    // Tuần tự: client transaction không chạy truy vấn song song.
    const minRep = await getConfig<number>(tx, "reviewer_min_reputation");
    const dueHours = await getConfig<number>(tx, "review_due_hours");
    const exclusionDays = await getConfig<number>(tx, "reviewer_exclusion_days");
    const submitter = proof.userId;
    const fingerprints = (
      await tx.deviceFingerprint.findMany({ where: { userId: submitter }, select: { fingerprintHash: true } })
    ).map((f) => f.fingerprintHash);
    const since = new Date(now.getTime() - exclusionDays * DAY_MS);

    const candidates = await tx.user.findMany({
      where: {
        id: { notIn: [submitter, ...proof.reviewAssignments.map((a) => a.reviewerId)] },
        status: "active",
        deletedAt: null,
        reputation: { gte: minRep },
        userSkills: { some: { skillId: proof.skillId, level: { gte: level.minReviewerLevel } } },
        sanctionsUser: {
          none: { kind: "review_ban", startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        },
        followsFollower: { none: { followeeId: submitter } },
        followsFollowee: { none: { followerId: submitter } },
        skillSwapsProposer: { none: { receiverId: submitter } },
        skillSwapsReceiver: { none: { proposerId: submitter } },
        ...(fingerprints.length > 0 ? { deviceFingerprints: { none: { fingerprintHash: { in: fingerprints } } } } : {}),
        reviewAssignments: { none: { assignedAt: { gte: since }, proof: { userId: submitter } } },
      },
      select: { id: true, reputation: true },
    });

    // Ngẫu nhiên (Fisher–Yates), rồi ưu tiên uy tín cao cho cấp cao / phá hòa (sort ổn định giữ ngẫu nhiên khi bằng nhau).
    const pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    if (p.preferHighReputation || proof.targetLevel >= proof.skill.maxLevel - 1) {
      pool.sort((a, b) => b.reputation - a.reputation);
    }
    const chosen = pool.slice(0, need).map((c) => c.id);

    if (chosen.length > 0) {
      const dueAt = new Date(now.getTime() + dueHours * HOUR_MS);
      await tx.reviewAssignment.createMany({
        data: chosen.map((reviewerId) => ({ proofId: proof.id, reviewerId, assignedAt: now, dueAt })),
      });
      await tx.notification.createMany({
        data: chosen.map((userId) => ({ userId, kind: "review_assigned", refType: "proof", refId: proof.id, createdAt: now })),
      });
      if (proof.status === "pending") {
        await tx.proof.update({ where: { id: proof.id }, data: { status: "in_review" } });
      }
    }
    return { assignedReviewerIds: chosen, shortfall: need - chosen.length };
  });
}

// ---------------------------------------------------------------------------
// expireOverdueAssignments (tác vụ nền reassignExpiredReviews)
// ---------------------------------------------------------------------------

/** Phân công quá hạn → `expired`, rồi gán người khác cho các bằng chứng còn đang duyệt. */
export async function expireOverdueAssignments(
  db: Db,
  p: { now?: Date; rng?: () => number } = {},
): Promise<{ expired: number; reassigned: number }> {
  const now = p.now ?? new Date();
  const overdue = await db.reviewAssignment.findMany({
    where: { state: "assigned", dueAt: { lt: now } },
    select: { id: true, proofId: true },
  });
  if (overdue.length === 0) return { expired: 0, reassigned: 0 };
  let reassigned = 0;
  const byProof = new Map<string, string[]>();
  for (const a of overdue) byProof.set(a.proofId, [...(byProof.get(a.proofId) ?? []), a.id]);
  for (const [proofId, ids] of byProof) {
    reassigned += await withTx(db, async (tx) => {
      await tx.reviewAssignment.updateMany({ where: { id: { in: ids }, state: "assigned" }, data: { state: "expired" } });
      const proof = await tx.proof.findUnique({ where: { id: proofId }, select: { status: true } });
      if (proof?.status !== "in_review") return 0;
      const r = await assignReviewers(tx, { proofId, now, rng: p.rng });
      return r.assignedReviewerIds.length;
    });
  }
  return { expired: overdue.length, reassigned };
}

// ---------------------------------------------------------------------------
// finalizeProof — nơi DUY NHẤT ghi user_skills.level
// ---------------------------------------------------------------------------

export type FinalizeProofResult =
  | { outcome: "already_decided"; proofId: string; status: "passed" | "failed" }
  | { outcome: "waiting"; proofId: string; votes: number; required: number }
  | {
      outcome: "needs_more_reviewers" | "tie";
      proofId: string;
      assignedReviewerIds: string[];
      shortfall: number;
    }
  | {
      outcome: "passed";
      proofId: string;
      skillId: string;
      newLevel: number;
      xpAwarded: number;
      badges: string[];
      passRatio: number;
      accountLevelBefore: number;
      accountLevel: number;
    }
  | { outcome: "failed"; proofId: string; passRatio: number };

/**
 * Chốt kết quả duyệt trong MỘT transaction (khóa hàng proofs FOR NO KEY UPDATE).
 * Idempotent: bằng chứng đã chốt → `already_decided`, không ghi gì thêm.
 * Chỉ tính phiếu của phân công `done` (vòng cũ trước kháng nghị đã chuyển `recused`, D41).
 * - Thiếu phiếu: còn phân công đang chờ → `waiting`; không còn ai → thêm người uy tín cao (`needs_more_reviewers`).
 * - Hòa: thêm một người duyệt uy tín cao (`tie`).
 * - Đạt khi tỉ lệ phiếu đạt ≥ review_pass_ratio: level = target_level, xp_ledger, total_xp/account_level,
 *   holder_count (khi đạt cấp cao nhất), huy hiệu, bài level_up, thông báo.
 * - Trượt: status failed, thông báo (nhận xét theo tiêu chí đã nằm trong review_marks).
 * - Sau khi chốt: uy tín người duyệt (+vote_matched / vote_mismatched), sổ cái reputation_events.
 */
export async function finalizeProof(
  db: Db,
  p: { proofId: string; now?: Date; rng?: () => number },
): Promise<FinalizeProofResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM proofs WHERE id = ${p.proofId}::uuid FOR NO KEY UPDATE`;
    const proof = await tx.proof.findUnique({
      where: { id: p.proofId },
      include: {
        skill: { select: { id: true, name: true, maxLevel: true, holderCount: true } },
        reviews: { select: { reviewerId: true, verdict: true, assignment: { select: { state: true } } } },
        reviewAssignments: { select: { id: true, state: true } },
      },
    });
    if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy bằng chứng.");
    if (proof.status === "passed" || proof.status === "failed") {
      return { outcome: "already_decided", proofId: proof.id, status: proof.status };
    }
    if (proof.status !== "in_review") {
      throw new DomainError("CONFLICT", "Bằng chứng không ở trạng thái đang duyệt.");
    }
    const level = await tx.skillLevel.findUniqueOrThrow({
      where: { skillId_level: { skillId: proof.skillId, level: proof.targetLevel } },
    });

    const reviews = proof.reviews.filter((r) => r.assignment.state === "done");
    const total = reviews.length;
    const passes = reviews.filter((r) => r.verdict === "pass").length;
    const outstanding = proof.reviewAssignments.filter((a) => a.state === "assigned").length;

    if (total < level.minReviewers) {
      if (outstanding > 0) return { outcome: "waiting", proofId: proof.id, votes: total, required: level.minReviewers };
      const r = await assignReviewers(tx, {
        proofId: proof.id,
        count: level.minReviewers - total,
        preferHighReputation: true,
        now,
        rng: p.rng,
      });
      return { outcome: "needs_more_reviewers", proofId: proof.id, ...r };
    }
    if (passes * 2 === total) {
      if (outstanding > 0) return { outcome: "waiting", proofId: proof.id, votes: total, required: total + 1 };
      const r = await assignReviewers(tx, { proofId: proof.id, count: 1, preferHighReputation: true, now, rng: p.rng });
      return { outcome: "tie", proofId: proof.id, ...r };
    }

    const ratio = await getConfig<number>(tx, "review_pass_ratio");
    const passRatio = passes / total;
    const passed = passRatio >= ratio - RATIO_EPSILON;

    await tx.proof.update({ where: { id: proof.id }, data: { status: passed ? "passed" : "failed", decidedAt: now } });
    // Phân công còn treo (người phá hòa chưa kịp chấm...) không cần nữa.
    await tx.reviewAssignment.updateMany({ where: { proofId: proof.id, state: "assigned" }, data: { state: "recused" } });

    // Uy tín người duyệt (DATA_MODEL mục 5).
    const deltas = await getConfig<ReputationDeltas>(tx, "reputation_deltas");
    for (const r of reviews) {
      const matched = (r.verdict === "pass") === passed;
      await applyReputation(tx, {
        userId: r.reviewerId,
        delta: matched ? deltas.vote_matched : deltas.vote_mismatched,
        reason: matched ? "vote_matched" : "vote_mismatched",
        refId: proof.id,
        now,
      });
    }

    if (!passed) {
      await tx.notification.create({
        data: { userId: proof.userId, kind: "proof_failed", refType: "proof", refId: proof.id, createdAt: now },
      });
      return { outcome: "failed", proofId: proof.id, passRatio };
    }

    // --- Đạt: ghi level (DUY NHẤT tại đây) ---
    const existing = await tx.userSkill.findUnique({
      where: { userId_skillId: { userId: proof.userId, skillId: proof.skillId } },
    });
    const newLevel = Math.max(existing?.level ?? 0, proof.targetLevel);
    await tx.userSkill.upsert({
      where: { userId_skillId: { userId: proof.userId, skillId: proof.skillId } },
      update: { level: newLevel, xp: { increment: level.xpReward }, lastProofId: proof.id, updatedAt: now },
      create: { userId: proof.userId, skillId: proof.skillId, level: newLevel, xp: level.xpReward, lastProofId: proof.id, updatedAt: now },
    });
    const xp = await awardXp(tx, {
      userId: proof.userId,
      amount: level.xpReward,
      reason: "proof_passed",
      skillId: proof.skillId,
      refType: "proof",
      refId: proof.id,
      now,
    });

    // Huy hiệu
    const badgeSlugs: string[] = [];
    const priorPassed = await tx.proof.count({
      where: { userId: proof.userId, status: "passed", id: { not: proof.id } },
    });
    if (priorPassed === 0) badgeSlugs.push("first-proof");
    if (proof.targetLevel === proof.skill.maxLevel && (existing?.level ?? 0) < proof.skill.maxLevel) {
      const rarity = rarityOf(proof.skill.holderCount, await getRarityThresholds(tx));
      await tx.skill.update({ where: { id: proof.skillId }, data: { holderCount: { increment: 1 } } });
      badgeSlugs.push("max-level");
      if (rarity === "rare") badgeSlugs.push("rare-holder");
      if (rarity === "legendary") badgeSlugs.push("legendary-holder");
    }
    const awarded: string[] = [];
    if (badgeSlugs.length > 0) {
      const badges = await tx.badge.findMany({ where: { slug: { in: badgeSlugs } } });
      for (const b of badges) {
        const r = await tx.userBadge.createMany({
          data: [{ userId: proof.userId, badgeId: b.id, proofId: proof.id, earnedAt: now }],
          skipDuplicates: true,
        });
        if (r.count > 0) awarded.push(b.slug);
      }
    }

    await tx.post.create({
      data: {
        authorId: proof.userId,
        kind: "level_up",
        proofId: proof.id,
        skillId: proof.skillId,
        body: `${proof.skill.name}: lên cấp ${proof.targetLevel}`,
        createdAt: now,
      },
    });
    await tx.notification.create({
      data: { userId: proof.userId, kind: "proof_passed", refType: "proof", refId: proof.id, createdAt: now },
    });

    return {
      outcome: "passed",
      proofId: proof.id,
      skillId: proof.skillId,
      newLevel,
      xpAwarded: level.xpReward,
      badges: awarded,
      passRatio,
      accountLevelBefore: xp.accountLevelBefore,
      accountLevel: xp.accountLevel,
    };
  });
}
