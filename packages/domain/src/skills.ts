import type { CriterionKind, RiskLevel, VoteValue } from "@skillverse/db";
import { getConfig, getRarityThresholds, type CriteriaChangeRule } from "./config";
import type { Db } from "./db";
import { DomainError } from "./errors";
import {
  loadLevelIndex,
  loadLevelTitles,
  userSkillProgressFields,
  type LevelTitleLookup,
  type UserSkillProgressFields,
} from "./milestones";
import { rarityOf, type Rarity } from "./rarity";
import { isSaved } from "./saves";
import { loadSelfProgress } from "./selfChecks";

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
  /** Tên mốc (vd. "Trời gió"). */
  title: string | null;
  /** Hướng dẫn cách đạt mốc — không phải tiêu chí chấm. */
  description: string | null;
  /** Việc cần làm để chấm = text tiêu chí đầu tiên của phiên bản hiện tại (null nếu chưa có tiêu chí). */
  task: string | null;
  xpReward: number;
  minReviewers: number;
  minReviewerLevel: number;
  criteriaVersionId: string | null;
  criteriaVersion: number | null;
  criteria: CriterionView[];
};

/** Trạng thái chờ duyệt của người xem trên một kỹ năng. */
export type PendingProofView = {
  proofId: string;
  targetLevel: number;
  /** Tên mốc của targetLevel. */
  levelTitle: string | null;
  status: "pending" | "in_review" | "disputed";
};

const PENDING_STATUSES = ["pending", "in_review", "disputed"] as const;

const levelInclude = {
  currentVersion: { include: { criteria: { orderBy: { position: "asc" as const } } } },
};

type LevelRow = {
  id: string;
  level: number;
  title: string | null;
  description: string | null;
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
  const criteria = l.currentVersion?.criteria ?? [];
  return {
    skillLevelId: l.id,
    level: l.level,
    title: l.title,
    description: l.description,
    task: criteria[0]?.text ?? null,
    xpReward: l.xpReward,
    minReviewers: l.minReviewers,
    minReviewerLevel: l.minReviewerLevel,
    criteriaVersionId: l.currentVersionId,
    criteriaVersion: l.currentVersion?.version ?? null,
    criteria: criteria.map((c) => ({
      id: c.id,
      position: c.position,
      text: c.text,
      kind: c.kind,
      threshold: c.threshold ? c.threshold.toNumber() : null,
    })),
  };
}

async function pendingProofsFor(db: Db, userId: string | null | undefined, skillIds: string[], titleOf: LevelTitleLookup) {
  const map = new Map<string, PendingProofView>();
  if (!userId || skillIds.length === 0) return map;
  const rows = await db.proof.findMany({
    where: { userId, skillId: { in: skillIds }, status: { in: [...PENDING_STATUSES] }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, skillId: true, targetLevel: true, status: true },
  });
  for (const r of rows) {
    if (!map.has(r.skillId)) {
      map.set(r.skillId, {
        proofId: r.id,
        targetLevel: r.targetLevel,
        levelTitle: titleOf(r.skillId, r.targetLevel),
        status: r.status as PendingProofView["status"],
      });
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

export type SkillTreeNode = UserSkillProgressFields & {
  skillId: string;
  slug: string;
  name: string;
  riskLevel: RiskLevel;
  level: number;
  /** Tên mốc đã xác thực (null khi level 0). */
  levelTitle: string | null;
  /** Tiến độ tự đánh dấu (D73) — luôn ≥ level; tiến độ hiển thị = selfLevel. */
  selfLevel: number;
  selfLevelTitle: string | null;
  maxLevel: number;
  /** Tên mốc kế tiếp sau tiến độ (selfLevel); null khi đã xong mốc cuối. */
  nextLevelTitle: string | null;
  state: SkillNodeState;
  holderCount: number;
  rarity: Rarity;
  /** Kỹ năng cha (trong toàn hệ thống) và đã thỏa chưa. */
  prerequisites: {
    skillId: string;
    slug: string;
    name: string;
    requiredLevel: number;
    /** Tên mốc cần đạt của kỹ năng cha. */
    requiredLevelTitle: string | null;
    userLevel: number;
    userLevelTitle: string | null;
    /** Tiến độ tự đánh dấu của người xem ở kỹ năng cha. */
    userSelfLevel: number;
    /** Mở khóa khi max(selfLevel, level) của kỹ năng cha ≥ requiredLevel (D73). */
    met: boolean;
  }[];
  /** Mốc kế tiếp sau tiến độ selfLevel (null nếu đã xong mốc cuối). Nộp bằng chứng vẫn cho level + 1. */
  next: (LevelView & { holdersAtOrAbove: number }) | null;
  pendingProof: PendingProofView | null;
};

export type SkillTree = {
  category: { id: string; slug: string; name: string };
  nodes: SkillTreeNode[];
  /** Cạnh giữa các nút trong danh mục này. */
  edges: { parentSkillId: string; childSkillId: string; requiredLevel: number; requiredLevelTitle: string | null }[];
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

  const idx = await loadLevelIndex(db, [...skillIds, ...parentIds]);
  const titleOf = idx.titleOf;
  const pending = await pendingProofsFor(db, input.userId, skillIds, titleOf);
  const allIds = [...new Set([...skillIds, ...parentIds])];
  const self = await loadSelfProgress(db, input.userId, allIds);
  const maxLevels = new Map(
    (await db.skill.findMany({ where: { id: { in: allIds } }, select: { id: true, maxLevel: true } })).map((r) => [r.id, r.maxLevel]),
  );
  const selfOf = (skillId: string) => self.selfLevel(skillId, myLevels.get(skillId) ?? 0, maxLevels.get(skillId) ?? 0);

  const nodes: SkillTreeNode[] = skills.map((s) => {
    const level = myLevels.get(s.id) ?? 0;
    const selfLevel = selfOf(s.id);
    const prerequisites = s.skillEdgesChildSkill.map((e) => {
      const userLevel = myLevels.get(e.parentSkillId) ?? 0;
      const userSelfLevel = selfOf(e.parentSkillId);
      return {
        skillId: e.parentSkillId,
        slug: e.parentSkill.slug,
        name: e.parentSkill.name,
        requiredLevel: e.requiredLevel,
        requiredLevelTitle: titleOf(e.parentSkillId, e.requiredLevel),
        userLevel,
        userLevelTitle: titleOf(e.parentSkillId, userLevel),
        userSelfLevel,
        met: Math.max(userLevel, userSelfLevel) >= e.requiredLevel,
      };
    });
    const state: SkillNodeState =
      level >= s.maxLevel ? "achieved" : prerequisites.every((p) => p.met) ? "practicing" : "locked";
    const nextRow = selfLevel < s.maxLevel ? s.skillLevels.find((l) => l.level === selfLevel + 1) : undefined;
    return {
      skillId: s.id,
      slug: s.slug,
      name: s.name,
      riskLevel: s.riskLevel,
      level,
      levelTitle: titleOf(s.id, level),
      selfLevel,
      selfLevelTitle: titleOf(s.id, selfLevel),
      maxLevel: s.maxLevel,
      nextLevelTitle: nextRow?.title ?? null,
      ...userSkillProgressFields(idx, s.id, level, selfLevel, s.maxLevel),
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
      .map((e) => ({
        parentSkillId: e.parentSkillId,
        childSkillId: e.childSkillId,
        requiredLevel: e.requiredLevel,
        requiredLevelTitle: titleOf(e.parentSkillId, e.requiredLevel),
      })),
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
  /** Tên mốc của targetLevel. */
  levelTitle: string | null;
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

export type NextMilestone = {
  skillLevelId: string;
  level: number;
  title: string | null;
  description: string | null;
  /** Việc cần làm (tiêu chí chấm). */
  task: string | null;
};

/** Mốc trong chi tiết kỹ năng, kèm trạng thái của người xem. */
export type DetailLevelView = LevelView & {
  /** Người xem đã tự đánh dấu mốc này (D73). */
  checked: boolean;
  /** Mốc đã được cộng đồng xác thực (level ≥ mốc). */
  verified: boolean;
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
  levels: DetailLevelView[];
  /** Số người có user_skills chưa đạt cấp cao nhất. */
  practicingCount: number;
  /** Cấp dùng cho chỉ số "đạt cấp X+" = maxLevel − 1 (tối thiểu 1). */
  advancedMinLevel: number;
  advancedCount: number;
  /** requiredLevelTitle = tên mốc của kỹ năng cha cần đạt. */
  parents: { skillId: string; slug: string; name: string; requiredLevel: number; requiredLevelTitle: string | null }[];
  /** requiredLevelTitle = tên mốc của kỹ năng NÀY mà kỹ năng con yêu cầu. */
  children: { skillId: string; slug: string; name: string; requiredLevel: number; requiredLevelTitle: string | null }[];
  myLevel: number | null;
  /** Tên mốc người xem đã đạt (null khi chưa theo / level 0). */
  myLevelTitle: string | null;
  /** Tiến độ tự đánh dấu (≥ myLevel ?? 0); tiến độ hiển thị = selfLevel. 0 khi chưa đăng nhập. */
  selfLevel: number;
  selfLevelTitle: string | null;
  /** Mốc kế tiếp sau tiến độ selfLevel (chưa theo = mốc 1). null khi đã xong mốc cuối. */
  nextMilestone: NextMilestone | null;
  /** Người xem đã lưu kỹ năng này (D74). */
  saved: boolean;
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
  const parentIdsAll = skill.skillEdgesChildSkill.map((e) => e.parentSkillId);
  const titleOf = await loadLevelTitles(db, [skill.id, ...parentIdsAll]);
  const pending = await pendingProofsFor(db, input.userId, [skill.id], titleOf);
  const self = await loadSelfProgress(db, input.userId, [skill.id]);
  const checkedSet = self.checked(skill.id);
  const selfLevel = self.selfLevel(skill.id, myLevel ?? 0, skill.maxLevel);
  const levels: DetailLevelView[] = skill.skillLevels.map((l) => ({
    ...toLevelView(l),
    checked: checkedSet.has(l.level),
    verified: (myLevel ?? 0) >= l.level,
  }));
  const nextLv = levels.find((l) => l.level === selfLevel + 1);
  const nextMilestone: NextMilestone | null = nextLv
    ? { skillLevelId: nextLv.skillLevelId, level: nextLv.level, title: nextLv.title, description: nextLv.description, task: nextLv.task }
    : null;

  const proposals = await db.proposal.findMany({
    where: { skillId: skill.id, kind: "edit_criteria", status: { in: ["gathering", "voting"] } },
    orderBy: { createdAt: "desc" },
    include: { skillLevel: { select: { level: true, title: true } }, proposalVotes: true },
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
      levelTitle: p.skillLevel?.title ?? null,
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
    levels,
    practicingCount,
    advancedMinLevel,
    advancedCount,
    parents: skill.skillEdgesChildSkill.map((e) => ({
      skillId: e.parentSkill.id,
      slug: e.parentSkill.slug,
      name: e.parentSkill.name,
      requiredLevel: e.requiredLevel,
      requiredLevelTitle: titleOf(e.parentSkill.id, e.requiredLevel),
    })),
    children: skill.skillEdgesParentSkill.map((e) => ({
      skillId: e.childSkill.id,
      slug: e.childSkill.slug,
      name: e.childSkill.name,
      requiredLevel: e.requiredLevel,
      requiredLevelTitle: titleOf(skill.id, e.requiredLevel),
    })),
    myLevel,
    myLevelTitle: titleOf(skill.id, myLevel),
    selfLevel,
    selfLevelTitle: titleOf(skill.id, selfLevel),
    nextMilestone,
    saved: await isSaved(db, input.userId, "skill", skill.id),
    myPendingProof: pending.get(skill.id) ?? null,
    myPrerequisitesMet,
    isFollowing,
    openProposals,
  };
}
