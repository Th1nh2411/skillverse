import type { CriterionKind, RiskLevel, VoteValue } from "@skillverse/db";
import { getConfig, getRarityThresholds, type CriteriaChangeRule } from "./config";
import type { Db } from "./db";
import { DomainError } from "./errors";
import { rarityOf, type Rarity } from "./rarity";

export type CriterionView = {
  id: string;
  position: number;
  text: string;
  kind: CriterionKind;
  threshold: number | null;
};

export type LevelView = {
  /** skill_levels.id — dùng tạo đề xuất sửa tiêu chí cho cấp này. */
  skillLevelId: string;
  level: number;
  title: string | null;
  xpReward: number;
  minReviewers: number;
  minReviewerLevel: number;
  criteriaVersionId: string | null;
  criteriaVersion: number | null;
  criteria: CriterionView[];
};

/** Trạng thái chờ duyệt của người xem trên một kỹ năng. */
export type PendingProofView = { proofId: string; targetLevel: number; status: "pending" | "in_review" | "disputed" };

const PENDING_STATUSES = ["pending", "in_review", "disputed"] as const;

const levelInclude = {
  currentVersion: { include: { criteria: { orderBy: { position: "asc" as const } } } },
};

type LevelRow = {
  id: string;
  level: number;
  title: string | null;
  xpReward: number;
  minReviewers: number;
  minReviewerLevel: number;
  currentVersionId: string | null;
  currentVersion: {
    id: string;
    version: number;
    criteria: { id: string; position: number; text: string; kind: CriterionKind; threshold: { toNumber(): number } | null }[];
  } | null;
};

function toLevelView(l: LevelRow): LevelView {
  return {
    skillLevelId: l.id,
    level: l.level,
    title: l.title,
    xpReward: l.xpReward,
    minReviewers: l.minReviewers,
    minReviewerLevel: l.minReviewerLevel,
    criteriaVersionId: l.currentVersionId,
    criteriaVersion: l.currentVersion?.version ?? null,
    criteria: (l.currentVersion?.criteria ?? []).map((c) => ({
      id: c.id,
      position: c.position,
      text: c.text,
      kind: c.kind,
      threshold: c.threshold ? c.threshold.toNumber() : null,
    })),
  };
}

async function pendingProofsFor(db: Db, userId: string | null | undefined, skillIds: string[]) {
  const map = new Map<string, PendingProofView>();
  if (!userId || skillIds.length === 0) return map;
  const rows = await db.proof.findMany({
    where: { userId, skillId: { in: skillIds }, status: { in: [...PENDING_STATUSES] }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, skillId: true, targetLevel: true, status: true },
  });
  for (const r of rows) {
    if (!map.has(r.skillId)) {
      map.set(r.skillId, { proofId: r.id, targetLevel: r.targetLevel, status: r.status as PendingProofView["status"] });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Cây kỹ năng
// ---------------------------------------------------------------------------

/**
 * achieved  = đạt cấp cao nhất;
 * practicing = đã mở (mọi kỹ năng cha đạt required_level), chưa đạt cấp cao nhất (kể cả level 0);
 * locked    = còn kỹ năng cha chưa đạt required_level.
 */
export type SkillNodeState = "achieved" | "practicing" | "locked";

export type SkillTreeNode = {
  skillId: string;
  slug: string;
  name: string;
  riskLevel: RiskLevel;
  level: number;
  maxLevel: number;
  state: SkillNodeState;
  holderCount: number;
  rarity: Rarity;
  /** Kỹ năng cha (trong toàn hệ thống) và đã thỏa chưa. */
  prerequisites: { skillId: string; slug: string; name: string; requiredLevel: number; userLevel: number; met: boolean }[];
  /** Yêu cầu cấp kế tiếp (null nếu đã đạt cấp cao nhất). */
  next: (LevelView & { holdersAtOrAbove: number }) | null;
  pendingProof: PendingProofView | null;
};

export type SkillTree = {
  category: { id: string; slug: string; name: string };
  nodes: SkillTreeNode[];
  /** Cạnh giữa các nút trong danh mục này. */
  edges: { parentSkillId: string; childSkillId: string; requiredLevel: number }[];
  unlockedCount: number;
  totalCount: number;
};

export async function getSkillTree(
  db: Db,
  input: { userId?: string | null; categorySlug: string },
): Promise<SkillTree> {
  const category = await db.category.findUnique({ where: { slug: input.categorySlug } });
  if (!category) throw new DomainError("NOT_FOUND", "Không tìm thấy danh mục.");
  const thresholds = await getRarityThresholds(db);

  const skills = await db.skill.findMany({
    where: { categoryId: category.id, status: "active" },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: {
      skillLevels: { orderBy: { level: "asc" }, include: levelInclude },
      skillEdgesChildSkill: { include: { parentSkill: { select: { id: true, slug: true, name: true } } } },
    },
  });
  const skillIds = skills.map((s) => s.id);
  const parentIds = [...new Set(skills.flatMap((s) => s.skillEdgesChildSkill.map((e) => e.parentSkillId)))];

  const myLevels = new Map<string, number>();
  if (input.userId) {
    const rows = await db.userSkill.findMany({
      where: { userId: input.userId, skillId: { in: [...new Set([...skillIds, ...parentIds])] } },
      select: { skillId: true, level: true },
    });
    for (const r of rows) myLevels.set(r.skillId, r.level);
  }

  const levelCounts = await db.userSkill.groupBy({
    by: ["skillId", "level"],
    where: { skillId: { in: skillIds }, level: { gte: 1 } },
    _count: { _all: true },
  });
  const holdersAtOrAbove = (skillId: string, level: number) =>
    levelCounts.filter((r) => r.skillId === skillId && r.level >= level).reduce((n, r) => n + r._count._all, 0);

  const pending = await pendingProofsFor(db, input.userId, skillIds);

  const nodes: SkillTreeNode[] = skills.map((s) => {
    const level = myLevels.get(s.id) ?? 0;
    const prerequisites = s.skillEdgesChildSkill.map((e) => {
      const userLevel = myLevels.get(e.parentSkillId) ?? 0;
      return {
        skillId: e.parentSkillId,
        slug: e.parentSkill.slug,
        name: e.parentSkill.name,
        requiredLevel: e.requiredLevel,
        userLevel,
        met: userLevel >= e.requiredLevel,
      };
    });
    const state: SkillNodeState =
      level >= s.maxLevel ? "achieved" : prerequisites.every((p) => p.met) ? "practicing" : "locked";
    const nextRow = level < s.maxLevel ? s.skillLevels.find((l) => l.level === level + 1) : undefined;
    return {
      skillId: s.id,
      slug: s.slug,
      name: s.name,
      riskLevel: s.riskLevel,
      level,
      maxLevel: s.maxLevel,
      state,
      holderCount: s.holderCount,
      rarity: rarityOf(s.holderCount, thresholds),
      prerequisites,
      next: nextRow ? { ...toLevelView(nextRow), holdersAtOrAbove: holdersAtOrAbove(s.id, nextRow.level) } : null,
      pendingProof: pending.get(s.id) ?? null,
    };
  });

  const inCat = new Set(skillIds);
  const edges = skills.flatMap((s) =>
    s.skillEdgesChildSkill
      .filter((e) => inCat.has(e.parentSkillId))
      .map((e) => ({ parentSkillId: e.parentSkillId, childSkillId: e.childSkillId, requiredLevel: e.requiredLevel })),
  );

  return {
    category: { id: category.id, slug: category.slug, name: category.name },
    nodes,
    edges,
    unlockedCount: nodes.filter((n) => n.state !== "locked").length,
    totalCount: nodes.length,
  };
}

// ---------------------------------------------------------------------------
// Chi tiết kỹ năng
// ---------------------------------------------------------------------------

export type CriteriaProposalView = {
  id: string;
  skillLevelId: string | null;
  targetLevel: number | null;
  summary: string | null;
  rationale: string | null;
  proposedCriteria: { text: string; kind: string }[];
  status: string;
  votingEndsAt: Date | null;
  /** Tổng số phiếu (mọi người). */
  voteCount: number;
  /** Số phiếu có trọng số > 0 (người đạt cấp ≥ voter_min_level). */
  weightedVoteCount: number;
  agreeWeight: number;
  totalWeight: number;
  /** agreeWeight / totalWeight, null khi chưa có phiếu có trọng số. */
  agreeRatio: number | null;
  rule: CriteriaChangeRule;
  myVote: VoteValue | null;
};

export type SkillDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: { id: string; slug: string; name: string };
  riskLevel: RiskLevel;
  maxLevel: number;
  holderCount: number;
  rarity: Rarity;
  levels: LevelView[];
  /** Số người có user_skills chưa đạt cấp cao nhất. */
  practicingCount: number;
  /** Cấp dùng cho chỉ số "đạt cấp X+" = maxLevel − 1 (tối thiểu 1). */
  advancedMinLevel: number;
  advancedCount: number;
  parents: { skillId: string; slug: string; name: string; requiredLevel: number }[];
  children: { skillId: string; slug: string; name: string; requiredLevel: number }[];
  myLevel: number | null;
  myPendingProof: PendingProofView | null;
  /** Người xem có đủ kỹ năng cha để nộp cấp kế tiếp không. */
  myPrerequisitesMet: boolean | null;
  isFollowing: boolean;
  openProposals: CriteriaProposalView[];
};

export async function getSkillDetail(
  db: Db,
  input: { slug: string; userId?: string | null },
): Promise<SkillDetail> {
  const skill = await db.skill.findFirst({
    where: { slug: input.slug, status: "active" },
    include: {
      category: true,
      skillLevels: { orderBy: { level: "asc" }, include: levelInclude },
      skillEdgesChildSkill: { include: { parentSkill: { select: { id: true, slug: true, name: true } } } },
      skillEdgesParentSkill: { include: { childSkill: { select: { id: true, slug: true, name: true } } } },
    },
  });
  if (!skill) throw new DomainError("NOT_FOUND", "Không tìm thấy kỹ năng.");
  const [thresholds, rule] = await Promise.all([
    getRarityThresholds(db),
    getConfig<CriteriaChangeRule>(db, "criteria_change_rule"),
  ]);
  const advancedMinLevel = Math.max(1, skill.maxLevel - 1);

  const [practicingCount, advancedCount] = await Promise.all([
    db.userSkill.count({ where: { skillId: skill.id, level: { lt: skill.maxLevel } } }),
    db.userSkill.count({ where: { skillId: skill.id, level: { gte: advancedMinLevel } } }),
  ]);

  let myLevel: number | null = null;
  let myPrerequisitesMet: boolean | null = null;
  let isFollowing = false;
  if (input.userId) {
    const parentIds = skill.skillEdgesChildSkill.map((e) => e.parentSkillId);
    const mine = await db.userSkill.findMany({
      where: { userId: input.userId, skillId: { in: [skill.id, ...parentIds] } },
      select: { skillId: true, level: true },
    });
    const lv = new Map(mine.map((m) => [m.skillId, m.level]));
    myLevel = lv.get(skill.id) ?? null;
    myPrerequisitesMet = skill.skillEdgesChildSkill.every((e) => (lv.get(e.parentSkillId) ?? 0) >= e.requiredLevel);
    isFollowing =
      (await db.skillFollow.count({ where: { userId: input.userId, skillId: skill.id } })) > 0;
  }
  const pending = await pendingProofsFor(db, input.userId, [skill.id]);

  const proposals = await db.proposal.findMany({
    where: { skillId: skill.id, kind: "edit_criteria", status: { in: ["gathering", "voting"] } },
    orderBy: { createdAt: "desc" },
    include: { skillLevel: { select: { level: true } }, proposalVotes: true },
  });

  const openProposals: CriteriaProposalView[] = proposals.map((p) => {
    const payload = (p.payload ?? {}) as { summary?: unknown; criteria?: unknown };
    const agreeWeight = p.proposalVotes.filter((v) => v.vote === "agree").reduce((n, v) => n + v.weight, 0);
    const totalWeight = p.proposalVotes
      .filter((v) => v.vote === "agree" || v.vote === "disagree")
      .reduce((n, v) => n + v.weight, 0);
    const proposedCriteria = Array.isArray(payload.criteria)
      ? (payload.criteria as unknown[]).flatMap((c) =>
          c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
            ? [{ text: (c as { text: string }).text, kind: String((c as { kind?: unknown }).kind ?? "checklist") }]
            : [],
        )
      : [];
    return {
      id: p.id,
      skillLevelId: p.skillLevelId,
      targetLevel: p.skillLevel?.level ?? null,
      summary: typeof payload.summary === "string" ? payload.summary : null,
      rationale: p.rationale,
      proposedCriteria,
      status: p.status,
      votingEndsAt: p.votingEndsAt,
      voteCount: p.proposalVotes.length,
      weightedVoteCount: p.proposalVotes.filter((v) => v.weight > 0).length,
      agreeWeight,
      totalWeight,
      agreeRatio: totalWeight > 0 ? agreeWeight / totalWeight : null,
      rule,
      myVote: input.userId ? (p.proposalVotes.find((v) => v.userId === input.userId)?.vote ?? null) : null,
    };
  });

  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    category: { id: skill.category.id, slug: skill.category.slug, name: skill.category.name },
    riskLevel: skill.riskLevel,
    maxLevel: skill.maxLevel,
    holderCount: skill.holderCount,
    rarity: rarityOf(skill.holderCount, thresholds),
    levels: skill.skillLevels.map(toLevelView),
    practicingCount,
    advancedMinLevel,
    advancedCount,
    parents: skill.skillEdgesChildSkill.map((e) => ({
      skillId: e.parentSkill.id,
      slug: e.parentSkill.slug,
      name: e.parentSkill.name,
      requiredLevel: e.requiredLevel,
    })),
    children: skill.skillEdgesParentSkill.map((e) => ({
      skillId: e.childSkill.id,
      slug: e.childSkill.slug,
      name: e.childSkill.name,
      requiredLevel: e.requiredLevel,
    })),
    myLevel,
    myPendingProof: pending.get(skill.id) ?? null,
    myPrerequisitesMet,
    isFollowing,
    openProposals,
  };
}
