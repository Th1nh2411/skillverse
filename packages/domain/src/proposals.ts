/**
 * Cộng đồng góp ý (DATA_MODEL mục 6): đề xuất kỹ năng mới + ủng hộ + biên tập duyệt; sửa tiêu chí bỏ phiếu có trọng số.
 * KHÔNG UPDATE bảng criteria: sửa tiêu chí = tạo criteria_versions mới và trỏ skill_levels.current_version_id.
 */
import type { CriterionKind, Prisma, ProposalKind, ProposalStatus, RiskLevel, Tx, VoteValue } from "@skillverse/db";
import { getConfig, type CriteriaChangeRule } from "./config";
import { withTx, type Db } from "./db";
import { normalizeVi } from "./discover";
import { DomainError } from "./errors";
import { awardXp, bumpDailyQuest } from "./ledger";
import { assertCanPost } from "./moderation";

const DAY_MS = 86_400_000;
const SUGGEST_QUEST_KEY = "suggest_criteria";

export type SupportRule = { supporters: number; days: number };
/** app_config.new_skill_defaults — thông số skill_levels khi mở kỹ năng mới. */
export type NewSkillDefaults = { xp_per_level: number; min_reviewers: number; reviewer_level_offset: number };

export type CriterionInput = { text: string; kind?: CriterionKind; threshold?: number | null };

export type NewSkillPayload = {
  name: string;
  categorySlug: string;
  description: string | null;
  riskLevel: RiskLevel;
  levels: { level: number; criteria: CriterionInput[] }[];
};

export type CriteriaEditPayload = { summary: string; criteria: CriterionInput[] };

async function assertEditor(db: Db, userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { isEditor: true, deletedAt: true } });
  if (!u?.isEditor || u.deletedAt) throw new DomainError("FORBIDDEN", "Chỉ biên tập viên được thực hiện.");
}

async function notifyEditors(tx: Tx, kind: string, refId: string, now: Date) {
  const editors = await tx.user.findMany({ where: { isEditor: true, deletedAt: null, status: "active" }, select: { id: true } });
  if (editors.length > 0) {
    await tx.notification.createMany({ data: editors.map((e) => ({ userId: e.id, kind, refType: "proposal", refId, createdAt: now })) });
  }
}

function cleanCriteria(list: CriterionInput[]): CriterionInput[] {
  const out = list
    .map((c) => ({ text: c.text.trim(), kind: c.kind ?? "checklist", threshold: c.threshold ?? null }))
    .filter((c) => c.text.length > 0);
  if (out.length === 0) throw new DomainError("BAD_REQUEST", "Mỗi cấp cần ít nhất một tiêu chí.");
  return out;
}

async function awardBadge(tx: Tx, userId: string, slug: string, now: Date) {
  const b = await tx.badge.findUnique({ where: { slug } });
  if (b) await tx.userBadge.createMany({ data: [{ userId, badgeId: b.id, earnedAt: now }], skipDuplicates: true });
}

// ---------------------------------------------------------------------------
// Kỹ năng mới
// ---------------------------------------------------------------------------

/** Tạo đề xuất kỹ năng mới (gathering), tác giả tự ủng hộ; hạn thu thập = new_skill_support_needed.days. */
export async function proposeNewSkill(
  db: Db,
  p: {
    authorId: string;
    name: string;
    categorySlug: string;
    description?: string | null;
    riskLevel: RiskLevel;
    /** Tiêu chí theo cấp, phần tử i là cấp i+1. */
    levels: CriterionInput[][];
    rationale?: string | null;
    now?: Date;
  },
): Promise<{ proposalId: string; votingEndsAt: Date }> {
  const now = p.now ?? new Date();
  const name = p.name.trim();
  if (name.length < 2) throw new DomainError("BAD_REQUEST", "Tên kỹ năng quá ngắn.");
  if (p.levels.length === 0) throw new DomainError("BAD_REQUEST", "Cần tiêu chí cho từng cấp.");
  return withTx(db, async (tx) => {
    await assertCanPost(tx, p.authorId, now);
    const cat = await tx.category.findUnique({ where: { slug: p.categorySlug } });
    if (!cat) throw new DomainError("BAD_REQUEST", "Danh mục không tồn tại.");
    const sameSkill = await tx.skill.count({ where: { name: { equals: name, mode: "insensitive" }, status: { not: "archived" } } });
    const open = await tx.proposal.findMany({
      where: { kind: "new_skill", status: { in: ["gathering", "voting", "editor_review"] } },
      select: { payload: true },
    });
    const key = normalizeVi(name);
    const sameOpen = open.filter((o) => normalizeVi(titleOf("new_skill", o.payload)) === key).length;
    if (sameSkill + sameOpen > 0) throw new DomainError("CONFLICT", "Đã có kỹ năng hoặc đề xuất trùng tên.");

    const rule = await getConfig<SupportRule>(tx, "new_skill_support_needed");
    const payload: NewSkillPayload = {
      name,
      categorySlug: cat.slug,
      description: p.description?.trim() || null,
      riskLevel: p.riskLevel,
      levels: p.levels.map((c, i) => ({ level: i + 1, criteria: cleanCriteria(c) })),
    };
    const votingEndsAt = new Date(now.getTime() + rule.days * DAY_MS);
    const proposal = await tx.proposal.create({
      data: {
        kind: "new_skill",
        authorId: p.authorId,
        payload: payload as unknown as Prisma.InputJsonValue,
        rationale: p.rationale?.trim() || null,
        status: "gathering",
        supportCount: 1,
        votingEndsAt,
        createdAt: now,
      },
    });
    await tx.proposalVote.create({ data: { proposalId: proposal.id, userId: p.authorId, vote: "support", weight: 1, createdAt: now } });
    return { proposalId: proposal.id, votingEndsAt };
  });
}

/**
 * Ủng hộ đề xuất kỹ năng mới (1 lần/người, trước hạn). support_count cập nhật cùng transaction;
 * đủ supporters → editor_review + thông báo biên tập viên.
 */
export async function supportProposal(
  db: Db,
  p: { proposalId: string; userId: string; now?: Date },
): Promise<{ supportCount: number; needed: number; status: ProposalStatus }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM proposals WHERE id = ${p.proposalId}::uuid FOR NO KEY UPDATE`;
    const pr = await tx.proposal.findUnique({ where: { id: p.proposalId } });
    if (!pr) throw new DomainError("NOT_FOUND", "Không tìm thấy đề xuất.");
    if (pr.kind !== "new_skill") throw new DomainError("BAD_REQUEST", "Chỉ ủng hộ được đề xuất kỹ năng mới.");
    if (pr.status !== "gathering" || (pr.votingEndsAt && pr.votingEndsAt <= now)) {
      throw new DomainError("PRECONDITION_FAILED", "Đề xuất không còn nhận ủng hộ.");
    }
    const r = await tx.proposalVote.createMany({
      data: [{ proposalId: pr.id, userId: p.userId, vote: "support", weight: 1, createdAt: now }],
      skipDuplicates: true,
    });
    if (r.count === 0) throw new DomainError("CONFLICT", "Bạn đã ủng hộ đề xuất này.");
    const rule = await getConfig<SupportRule>(tx, "new_skill_support_needed");
    const supportCount = await tx.proposalVote.count({ where: { proposalId: pr.id, vote: "support" } });
    const status: ProposalStatus = supportCount >= rule.supporters ? "editor_review" : "gathering";
    await tx.proposal.update({ where: { id: pr.id }, data: { supportCount, status } });
    if (status === "editor_review") {
      await notifyEditors(tx, "proposal_editor_review", pr.id, now);
      await tx.notification.create({ data: { userId: pr.authorId, kind: "proposal_editor_review", refType: "proposal", refId: pr.id, createdAt: now } });
    }
    return { supportCount, needed: rule.supporters, status };
  });
}

function slugify(name: string): string {
  return (
    normalizeVi(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "ky-nang"
  );
}

/**
 * Biên tập viên quyết định đề xuất kỹ năng mới (đang editor_review). Mọi kỹ năng mới — kể cả risk_level = high —
 * đều phải qua bước này. accepted → skills(active) + skill_levels + criteria_versions v1 + criteria,
 * XP proposal_accepted + huy hiệu cho tác giả.
 */
export async function decideNewSkill(
  db: Db,
  p: { proposalId: string; editorId: string; decision: "accepted" | "rejected"; note?: string | null; now?: Date },
): Promise<{ proposalId: string; status: "accepted" | "rejected"; skillId: string | null; skillSlug: string | null }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await assertEditor(tx, p.editorId);
    await tx.$queryRaw`SELECT id FROM proposals WHERE id = ${p.proposalId}::uuid FOR NO KEY UPDATE`;
    const pr = await tx.proposal.findUnique({ where: { id: p.proposalId } });
    if (!pr || pr.kind !== "new_skill") throw new DomainError("NOT_FOUND", "Không tìm thấy đề xuất kỹ năng mới.");
    if (pr.status !== "editor_review") throw new DomainError("PRECONDITION_FAILED", "Đề xuất chưa tới bước biên tập.");
    if (pr.authorId === p.editorId) throw new DomainError("FORBIDDEN", "Không tự duyệt đề xuất của mình.");

    if (p.decision === "rejected") {
      await tx.proposal.update({ where: { id: pr.id }, data: { status: "rejected", decidedBy: p.editorId, decidedAt: now } });
      await tx.notification.create({ data: { userId: pr.authorId, kind: "proposal_rejected", refType: "proposal", refId: pr.id, createdAt: now } });
      return { proposalId: pr.id, status: "rejected", skillId: null, skillSlug: null };
    }

    const payload = pr.payload as unknown as NewSkillPayload;
    const cat = await tx.category.findUnique({ where: { slug: payload.categorySlug } });
    if (!cat) throw new DomainError("PRECONDITION_FAILED", "Danh mục của đề xuất không còn tồn tại.");
    const defaults = await getConfig<NewSkillDefaults>(tx, "new_skill_defaults");
    const base = slugify(payload.name);
    let slug = base;
    for (let i = 2; await tx.skill.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

    const skill = await tx.skill.create({
      data: {
        slug,
        name: payload.name,
        categoryId: cat.id,
        description: payload.description,
        riskLevel: payload.riskLevel,
        status: "active",
        maxLevel: payload.levels.length,
        createdBy: pr.authorId,
        createdAt: now,
      },
    });
    for (const lv of payload.levels) {
      const sl = await tx.skillLevel.create({
        data: {
          skillId: skill.id,
          level: lv.level,
          xpReward: defaults.xp_per_level * lv.level,
          minReviewers: defaults.min_reviewers,
          minReviewerLevel: Math.max(1, lv.level - defaults.reviewer_level_offset),
        },
      });
      const v = await tx.criteriaVersion.create({
        data: {
          skillLevelId: sl.id,
          version: 1,
          sourceProposalId: pr.id,
          createdAt: now,
          criteria: {
            create: lv.criteria.map((c, i) => ({ position: i + 1, text: c.text, kind: c.kind ?? "checklist", threshold: c.threshold ?? null })),
          },
        },
      });
      await tx.skillLevel.update({ where: { id: sl.id }, data: { currentVersionId: v.id } });
    }
    await tx.proposal.update({
      where: { id: pr.id },
      data: { status: "accepted", decidedBy: p.editorId, decidedAt: now, skillId: skill.id },
    });
    await rewardAuthor(tx, pr.authorId, pr.id, now);
    await tx.notification.create({ data: { userId: pr.authorId, kind: "proposal_accepted", refType: "proposal", refId: pr.id, createdAt: now } });
    return { proposalId: pr.id, status: "accepted", skillId: skill.id, skillSlug: slug };
  });
}

async function rewardAuthor(tx: Tx, authorId: string, proposalId: string, now: Date) {
  const rewards = await getConfig<{ proposal_accepted: number }>(tx, "xp_rewards");
  await awardXp(tx, { userId: authorId, amount: rewards.proposal_accepted, reason: "proposal_accepted", refType: "proposal", refId: proposalId, now });
  await awardBadge(tx, authorId, "proposal-accepted", now);
}

// ---------------------------------------------------------------------------
// Sửa tiêu chí
// ---------------------------------------------------------------------------

/** Đề xuất sửa tiêu chí một cấp (status voting, hạn criteria_vote_days). Tiến nhiệm vụ suggest_criteria. */
export async function proposeCriteriaEdit(
  db: Db,
  p: { authorId: string; skillLevelId: string; criteria: CriterionInput[]; summary: string; rationale?: string | null; now?: Date },
): Promise<{ proposalId: string; votingEndsAt: Date }> {
  const now = p.now ?? new Date();
  const summary = p.summary.trim();
  if (!summary) throw new DomainError("BAD_REQUEST", "Cần tóm tắt thay đổi.");
  return withTx(db, async (tx) => {
    await assertCanPost(tx, p.authorId, now);
    const sl = await tx.skillLevel.findUnique({ where: { id: p.skillLevelId }, include: { skill: { select: { id: true, status: true } } } });
    if (!sl || sl.skill.status !== "active") throw new DomainError("NOT_FOUND", "Không tìm thấy cấp kỹ năng.");
    const days = await getConfig<number>(tx, "criteria_vote_days");
    const payload: CriteriaEditPayload = { summary, criteria: cleanCriteria(p.criteria) };
    const votingEndsAt = new Date(now.getTime() + days * DAY_MS);
    const pr = await tx.proposal.create({
      data: {
        kind: "edit_criteria",
        authorId: p.authorId,
        skillId: sl.skill.id,
        skillLevelId: sl.id,
        payload: payload as unknown as Prisma.InputJsonValue,
        rationale: p.rationale?.trim() || null,
        status: "voting",
        votingEndsAt,
        createdAt: now,
      },
    });
    await bumpDailyQuest(tx, { userId: p.authorId, questKey: SUGGEST_QUEST_KEY, now });
    return { proposalId: pr.id, votingEndsAt };
  });
}

export type CriteriaTally = {
  voteCount: number;
  /** Số phiếu có trọng số > 0. */
  weightedVoteCount: number;
  agreeWeight: number;
  totalWeight: number;
  agreeRatio: number | null;
};

export async function tallyCriteriaVotes(db: Db, proposalId: string): Promise<CriteriaTally> {
  const votes = await db.proposalVote.findMany({ where: { proposalId, vote: { in: ["agree", "disagree"] } }, select: { vote: true, weight: true } });
  const agreeWeight = votes.filter((v) => v.vote === "agree").reduce((n, v) => n + v.weight, 0);
  const totalWeight = votes.reduce((n, v) => n + v.weight, 0);
  return {
    voteCount: votes.length,
    weightedVoteCount: votes.filter((v) => v.weight > 0).length,
    agreeWeight,
    totalWeight,
    agreeRatio: totalWeight > 0 ? agreeWeight / totalWeight : null,
  };
}

/**
 * Bỏ phiếu sửa tiêu chí. weight = 1 nếu người bỏ phiếu đạt cấp ≥ criteria_change_rule.voter_min_level của
 * kỹ năng đó, ngược lại 0. 1 phiếu/người, đổi phiếu được trước hạn. Phiếu đầu tiên tiến nhiệm vụ suggest_criteria.
 */
export async function voteCriteriaEdit(
  db: Db,
  p: { proposalId: string; userId: string; vote: "agree" | "disagree"; now?: Date },
): Promise<CriteriaTally & { myVote: VoteValue; myWeight: number }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const pr = await tx.proposal.findUnique({ where: { id: p.proposalId } });
    if (!pr || pr.kind !== "edit_criteria") throw new DomainError("NOT_FOUND", "Không tìm thấy đề xuất sửa tiêu chí.");
    if (pr.status !== "voting" || !pr.votingEndsAt || pr.votingEndsAt <= now) {
      throw new DomainError("PRECONDITION_FAILED", "Đề xuất đã hết hạn bỏ phiếu.");
    }
    const rule = await getConfig<CriteriaChangeRule>(tx, "criteria_change_rule");
    const us = pr.skillId
      ? await tx.userSkill.findUnique({ where: { userId_skillId: { userId: p.userId, skillId: pr.skillId } }, select: { level: true } })
      : null;
    const weight = (us?.level ?? 0) >= rule.voter_min_level ? 1 : 0;
    const existing = await tx.proposalVote.findUnique({ where: { proposalId_userId: { proposalId: pr.id, userId: p.userId } } });
    if (existing) {
      await tx.proposalVote.update({
        where: { proposalId_userId: { proposalId: pr.id, userId: p.userId } },
        data: { vote: p.vote, weight, createdAt: now },
      });
    } else {
      await tx.proposalVote.create({ data: { proposalId: pr.id, userId: p.userId, vote: p.vote, weight, createdAt: now } });
      await bumpDailyQuest(tx, { userId: p.userId, questKey: SUGGEST_QUEST_KEY, now });
    }
    return { ...(await tallyCriteriaVotes(tx, pr.id)), myVote: p.vote, myWeight: weight };
  });
}

export type CloseProposalResult =
  | { proposalId: string; status: "accepted"; criteriaVersionId: string; version: number; tally: CriteriaTally }
  | { proposalId: string; status: "rejected" | "expired"; tally: CriteriaTally | null };

/**
 * Chốt đề xuất sửa tiêu chí sau hạn. Thông qua khi số phiếu có trọng số ≥ min_votes VÀ agree/total trọng số ≥ agree_ratio
 * → criteria_versions mới (version+1, source_proposal_id), trỏ current_version_id, XP + huy hiệu tác giả.
 * Không đủ phiếu → expired; đủ phiếu nhưng dưới tỉ lệ (kể cả hòa) → rejected.
 */
export async function closeCriteriaProposal(
  db: Db,
  p: { proposalId: string; now?: Date },
): Promise<CloseProposalResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM proposals WHERE id = ${p.proposalId}::uuid FOR NO KEY UPDATE`;
    const pr = await tx.proposal.findUnique({ where: { id: p.proposalId } });
    if (!pr || pr.kind !== "edit_criteria") throw new DomainError("NOT_FOUND", "Không tìm thấy đề xuất sửa tiêu chí.");
    if (pr.status !== "voting") throw new DomainError("CONFLICT", "Đề xuất đã được chốt.");
    if (pr.votingEndsAt && pr.votingEndsAt > now) throw new DomainError("PRECONDITION_FAILED", "Chưa hết hạn bỏ phiếu.");
    const rule = await getConfig<CriteriaChangeRule>(tx, "criteria_change_rule");
    const tally = await tallyCriteriaVotes(tx, pr.id);
    const enough = tally.weightedVoteCount >= rule.min_votes;
    // So bằng số nguyên trọng số để đúng 70% không bị sai số dấu phẩy động.
    const passed = enough && tally.totalWeight > 0 && tally.agreeWeight >= rule.agree_ratio * tally.totalWeight - 1e-9;

    if (!passed || !pr.skillLevelId) {
      const status = enough ? "rejected" : "expired";
      await tx.proposal.update({ where: { id: pr.id }, data: { status, decidedAt: now } });
      await tx.notification.create({ data: { userId: pr.authorId, kind: `proposal_${status}`, refType: "proposal", refId: pr.id, createdAt: now } });
      return { proposalId: pr.id, status, tally };
    }

    const payload = pr.payload as unknown as CriteriaEditPayload;
    const last = await tx.criteriaVersion.findFirst({ where: { skillLevelId: pr.skillLevelId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    const v = await tx.criteriaVersion.create({
      data: {
        skillLevelId: pr.skillLevelId,
        version,
        sourceProposalId: pr.id,
        createdAt: now,
        criteria: {
          create: payload.criteria.map((c, i) => ({ position: i + 1, text: c.text, kind: c.kind ?? "checklist", threshold: c.threshold ?? null })),
        },
      },
    });
    await tx.skillLevel.update({ where: { id: pr.skillLevelId }, data: { currentVersionId: v.id } });
    await tx.proposal.update({ where: { id: pr.id }, data: { status: "accepted", decidedAt: now } });
    await rewardAuthor(tx, pr.authorId, pr.id, now);
    await tx.notification.create({ data: { userId: pr.authorId, kind: "proposal_accepted", refType: "proposal", refId: pr.id, createdAt: now } });
    return { proposalId: pr.id, status: "accepted", criteriaVersionId: v.id, version, tally };
  });
}

/** Cron: chốt sửa tiêu chí hết hạn; kỹ năng mới hết hạn mà chưa đủ ủng hộ → expired. Idempotent. */
export async function closeExpiredProposals(
  db: Db,
  p: { now?: Date } = {},
): Promise<{ criteriaClosed: number; criteriaAccepted: number; newSkillExpired: number }> {
  const now = p.now ?? new Date();
  const edits = await db.proposal.findMany({
    where: { kind: "edit_criteria", status: "voting", votingEndsAt: { lte: now } },
    select: { id: true },
  });
  let criteriaAccepted = 0;
  let criteriaClosed = 0;
  for (const e of edits) {
    try {
      const r = await closeCriteriaProposal(db, { proposalId: e.id, now });
      criteriaClosed += 1;
      if (r.status === "accepted") criteriaAccepted += 1;
    } catch (err) {
      if (!(err instanceof DomainError && err.code === "CONFLICT")) throw err;
    }
  }
  const stale = await db.proposal.findMany({
    where: { kind: "new_skill", status: "gathering", votingEndsAt: { lte: now } },
    select: { id: true, authorId: true },
  });
  let newSkillExpired = 0;
  for (const s of stale) {
    await withTx(db, async (tx) => {
      const r = await tx.proposal.updateMany({ where: { id: s.id, status: "gathering" }, data: { status: "expired", decidedAt: now } });
      if (r.count > 0) {
        newSkillExpired += 1;
        await tx.notification.create({ data: { userId: s.authorId, kind: "proposal_expired", refType: "proposal", refId: s.id, createdAt: now } });
      }
    });
  }
  return { criteriaClosed, criteriaAccepted, newSkillExpired };
}

// ---------------------------------------------------------------------------
// Truy vấn + bình luận
// ---------------------------------------------------------------------------

export type ProposalSummary = {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  title: string;
  author: { handle: string; displayName: string };
  skill: { slug: string; name: string } | null;
  targetLevel: number | null;
  createdAt: Date;
  votingEndsAt: Date | null;
  supportCount: number;
  /** Chỉ với new_skill: số ủng hộ cần. */
  supportNeeded: number | null;
  /** Chỉ với new_skill: luật ủng hộ từ app_config.new_skill_support_needed. */
  supportRule: SupportRule | null;
  /** Người xem đã ủng hộ (new_skill). false khi không có viewerId. */
  mySupport: boolean;
  tally: CriteriaTally | null;
  commentCount: number;
  myVote: VoteValue | null;
};

function titleOf(kind: ProposalKind, payload: unknown): string {
  const o = (payload ?? {}) as { name?: unknown; summary?: unknown };
  if (kind === "new_skill" && typeof o.name === "string") return o.name;
  if (typeof o.summary === "string") return o.summary;
  return "Đề xuất";
}

const summaryInclude = {
  author: { select: { handle: true, displayName: true } },
  skill: { select: { slug: true, name: true } },
  skillLevel: { select: { level: true } },
  _count: { select: { proposalComments: true } },
} as const;

async function toSummaries(
  db: Db,
  rows: Prisma.ProposalGetPayload<{ include: typeof summaryInclude }>[],
  viewerId: string | null | undefined,
): Promise<ProposalSummary[]> {
  const support = await getConfig<SupportRule>(db, "new_skill_support_needed");
  const mine = viewerId && rows.length
    ? await db.proposalVote.findMany({ where: { userId: viewerId, proposalId: { in: rows.map((r) => r.id) } }, select: { proposalId: true, vote: true } })
    : [];
  const out: ProposalSummary[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      kind: r.kind,
      status: r.status,
      title: titleOf(r.kind, r.payload),
      author: r.author,
      skill: r.skill,
      targetLevel: r.skillLevel?.level ?? null,
      createdAt: r.createdAt,
      votingEndsAt: r.votingEndsAt,
      supportCount: r.supportCount,
      supportNeeded: r.kind === "new_skill" ? support.supporters : null,
      supportRule: r.kind === "new_skill" ? support : null,
      mySupport: mine.some((m) => m.proposalId === r.id && m.vote === "support"),
      tally: r.kind === "edit_criteria" ? await tallyCriteriaVotes(db, r.id) : null,
      commentCount: r._count.proposalComments,
      myVote: mine.find((m) => m.proposalId === r.id)?.vote ?? null,
    });
  }
  return out;
}

export async function listProposals(
  db: Db,
  p: {
    viewerId?: string | null;
    kind?: ProposalKind;
    skillId?: string;
    skillSlug?: string;
    status?: ProposalStatus | ProposalStatus[];
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<{ items: ProposalSummary[]; nextCursor: string | null }> {
  const limit = p.limit ?? 20;
  const statuses = p.status ? (Array.isArray(p.status) ? p.status : [p.status]) : undefined;
  const rows = await db.proposal.findMany({
    where: {
      ...(p.kind ? { kind: p.kind } : {}),
      ...(p.skillId ? { skillId: p.skillId } : {}),
      ...(p.skillSlug ? { skill: { slug: p.skillSlug } } : {}),
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    include: summaryInclude,
  });
  const page = rows.slice(0, limit);
  return {
    items: await toSummaries(db, page, p.viewerId),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export type ProposalDetail = ProposalSummary & {
  rationale: string | null;
  payload: NewSkillPayload | CriteriaEditPayload | Record<string, unknown>;
  /** Với edit_criteria: tiêu chí hiện hành của cấp đó để so sánh. */
  currentCriteria: { position: number; text: string }[] | null;
  rule: CriteriaChangeRule | null;
  /** Trọng số phiếu của người xem nếu bỏ phiếu (edit_criteria). */
  myWeight: number | null;
  decidedAt: Date | null;
  createdSkillSlug: string | null;
};

export async function getProposal(db: Db, p: { proposalId: string; viewerId?: string | null }): Promise<ProposalDetail> {
  const r = await db.proposal.findUnique({
    where: { id: p.proposalId },
    include: {
      ...summaryInclude,
      skillLevel: {
        select: { level: true, currentVersion: { select: { criteria: { orderBy: { position: "asc" }, select: { position: true, text: true } } } } },
      },
    },
  });
  if (!r) throw new DomainError("NOT_FOUND", "Không tìm thấy đề xuất.");
  const [summary] = await toSummaries(db, [r], p.viewerId);
  let rule: CriteriaChangeRule | null = null;
  let myWeight: number | null = null;
  if (r.kind === "edit_criteria") {
    rule = await getConfig<CriteriaChangeRule>(db, "criteria_change_rule");
    if (p.viewerId && r.skillId) {
      const us = await db.userSkill.findUnique({ where: { userId_skillId: { userId: p.viewerId, skillId: r.skillId } }, select: { level: true } });
      myWeight = (us?.level ?? 0) >= rule.voter_min_level ? 1 : 0;
    }
  }
  return {
    ...summary!,
    rationale: r.rationale,
    payload: r.payload as ProposalDetail["payload"],
    currentCriteria: r.skillLevel?.currentVersion?.criteria ?? null,
    rule,
    myWeight,
    decidedAt: r.decidedAt,
    createdSkillSlug: r.kind === "new_skill" && r.status === "accepted" ? (r.skill?.slug ?? null) : null,
  };
}

export async function commentOnProposal(
  db: Db,
  p: { proposalId: string; userId: string; body: string; now?: Date },
): Promise<{ commentId: string }> {
  const now = p.now ?? new Date();
  const body = p.body.trim();
  if (!body) throw new DomainError("BAD_REQUEST", "Bình luận trống.");
  return withTx(db, async (tx) => {
    await assertCanPost(tx, p.userId, now);
    const pr = await tx.proposal.findUnique({ where: { id: p.proposalId }, select: { id: true, authorId: true, kind: true } });
    if (!pr) throw new DomainError("NOT_FOUND", "Không tìm thấy đề xuất.");
    const c = await tx.proposalComment.create({ data: { proposalId: pr.id, userId: p.userId, body, createdAt: now } });
    if (pr.kind === "edit_criteria") await bumpDailyQuest(tx, { userId: p.userId, questKey: SUGGEST_QUEST_KEY, now });
    if (pr.authorId !== p.userId) {
      await tx.notification.create({ data: { userId: pr.authorId, kind: "proposal_comment", refType: "proposal", refId: pr.id, createdAt: now } });
    }
    return { commentId: c.id };
  });
}

export async function listProposalComments(
  db: Db,
  p: { proposalId: string; cursor?: string | null; limit?: number },
): Promise<{ items: { id: string; body: string; createdAt: Date; author: { handle: string; displayName: string; avatarUrl: string | null } }[]; nextCursor: string | null }> {
  const limit = p.limit ?? 30;
  const rows = await db.proposalComment.findMany({
    where: { proposalId: p.proposalId, user: { deletedAt: null, status: { not: "banned" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
    select: { id: true, body: true, createdAt: true, user: { select: { handle: true, displayName: true, avatarUrl: true } } },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt, author: r.user })),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}
