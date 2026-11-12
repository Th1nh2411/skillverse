/**
 * Truy vấn phía người nộp và công khai: trạng thái bằng chứng, tóm tắt lên cấp, thẻ chia sẻ.
 */
import type { AppealStatus, ProofStatus } from "@skillverse/db";
import { getAccountLevelCurve, getConfig, getRarityThresholds } from "./config";
import type { Db } from "./db";
import { DomainError } from "./errors";
import { rarityOf, type Rarity } from "./rarity";
import { accountLevelForXp } from "./xp";

const DAY_MS = 86_400_000;

export type ProofStatusView = {
  proofId: string;
  status: ProofStatus;
  /** disputed = đang chờ biên tập viên (vd. video trùng). */
  underEditorReview: boolean;
  skill: { slug: string; name: string; maxLevel: number; category: { slug: string; name: string }; rarity: Rarity };
  targetLevel: number;
  levelTitle: string | null;
  mediaKey: string;
  caption: string | null;
  submittedAt: Date;
  decidedAt: Date | null;
  /** Số phiếu đã có trong vòng hiện tại / số phiếu cần. */
  votes: number;
  required: number;
  /** Kết quả từng tiêu chí — chỉ có khi đã chốt (passed/failed). */
  criteria: { id: string; position: number; text: string; metCount: number; notMetCount: number }[] | null;
  /** Nhận xét ẩn danh của người duyệt — chỉ khi đã chốt. */
  comments: string[] | null;
  appeal: { status: AppealStatus; createdAt: Date } | null;
  canAppeal: boolean;
  appealDeadline: Date | null;
};

/** Trạng thái bằng chứng cho người nộp (hoặc biên tập viên). Không lộ danh tính người duyệt. */
export async function getProofStatus(
  db: Db,
  p: { proofId: string; userId: string; isEditor?: boolean; now?: Date },
): Promise<ProofStatusView> {
  const now = p.now ?? new Date();
  const proof = await db.proof.findFirst({
    where: { id: p.proofId, deletedAt: null },
    include: {
      skill: { select: { slug: true, name: true, maxLevel: true, holderCount: true, category: { select: { slug: true, name: true } } } },
      appeal: { select: { status: true, createdAt: true } },
      criteriaVersion: { select: { criteria: { orderBy: { position: "asc" } } } },
      reviews: {
        where: { assignment: { state: "done" } },
        select: { comment: true, createdAt: true, reviewMarks: { select: { criterionId: true, met: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy bằng chứng.");
  if (proof.userId !== p.userId && !p.isEditor) throw new DomainError("FORBIDDEN", "Bạn không xem được bằng chứng này.");

  const level = await db.skillLevel.findUnique({
    where: { skillId_level: { skillId: proof.skillId, level: proof.targetLevel } },
    select: { title: true, minReviewers: true },
  });
  const decided = proof.status === "passed" || proof.status === "failed";
  const windowDays = await getConfig<number>(db, "appeal_window_days");
  const appealDeadline =
    proof.status === "failed" && proof.decidedAt ? new Date(proof.decidedAt.getTime() + windowDays * DAY_MS) : null;
  const marks = proof.reviews.flatMap((r) => r.reviewMarks);

  return {
    proofId: proof.id,
    status: proof.status,
    underEditorReview: proof.status === "disputed",
    skill: {
      slug: proof.skill.slug,
      name: proof.skill.name,
      maxLevel: proof.skill.maxLevel,
      category: proof.skill.category,
      rarity: rarityOf(proof.skill.holderCount, await getRarityThresholds(db)),
    },
    targetLevel: proof.targetLevel,
    levelTitle: level?.title ?? null,
    mediaKey: proof.mediaUrl,
    caption: proof.caption,
    submittedAt: proof.createdAt,
    decidedAt: proof.decidedAt,
    votes: proof.reviews.length,
    required: level?.minReviewers ?? 0,
    criteria: decided
      ? proof.criteriaVersion.criteria.map((c) => ({
          id: c.id,
          position: c.position,
          text: c.text,
          metCount: marks.filter((m) => m.criterionId === c.id && m.met).length,
          notMetCount: marks.filter((m) => m.criterionId === c.id && !m.met).length,
        }))
      : null,
    comments: decided ? proof.reviews.flatMap((r) => (r.comment ? [r.comment] : [])) : null,
    appeal: proof.appeal,
    canAppeal:
      proof.userId === p.userId && !proof.appeal && !!appealDeadline && now.getTime() <= appealDeadline.getTime(),
    appealDeadline,
  };
}

export type LevelUpSummary = {
  proofId: string;
  skill: { slug: string; name: string; category: { slug: string; name: string }; maxLevel: number; rarity: Rarity };
  level: number;
  levelTitle: string | null;
  /** Tên mốc kế tiếp (null khi vừa xong mốc cuối). */
  nextLevelTitle: string | null;
  isMaxLevel: boolean;
  xpAwarded: number;
  accountLevelBefore: number;
  accountLevelAfter: number;
  /** Số phiếu đạt / tổng phiếu của vòng quyết định ("Đã được xác thực 3/3"). */
  passVotes: number;
  totalVotes: number;
  /** "Bạn thuộc top N% người luyện kỹ năng này" (1..100). */
  topPercent: number;
  badges: { slug: string; name: string; description: string | null }[];
  /** Kỹ năng con vừa mở nhờ đạt cấp này (mọi kỹ năng cha khác cũng đã đạt). */
  unlockedSkills: { slug: string; name: string }[];
  displayName: string;
};

/** Màn Lên cấp cho người nộp (bằng chứng phải đã đạt). */
export async function getLevelUpSummary(db: Db, p: { proofId: string; userId: string }): Promise<LevelUpSummary> {
  const proof = await db.proof.findFirst({
    where: { id: p.proofId, deletedAt: null },
    include: {
      user: { select: { displayName: true } },
      skill: {
        select: {
          id: true,
          slug: true,
          name: true,
          maxLevel: true,
          holderCount: true,
          category: { select: { slug: true, name: true } },
          skillEdgesParentSkill: {
            select: {
              requiredLevel: true,
              childSkill: {
                select: { id: true, slug: true, name: true, status: true, skillEdgesChildSkill: { select: { parentSkillId: true, requiredLevel: true } } },
              },
            },
          },
        },
      },
      reviews: { where: { assignment: { state: "done" } }, select: { verdict: true } },
      userBadges: { select: { badge: { select: { slug: true, name: true, description: true } } } },
    },
  });
  if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy bằng chứng.");
  if (proof.userId !== p.userId) throw new DomainError("FORBIDDEN", "Bạn không xem được bằng chứng này.");
  if (proof.status !== "passed") throw new DomainError("PRECONDITION_FAILED", "Bằng chứng chưa được xác thực.");

  const [level, nextLevel, ledgerRow, curve, thresholds] = await Promise.all([
    db.skillLevel.findUnique({
      where: { skillId_level: { skillId: proof.skillId, level: proof.targetLevel } },
      select: { title: true },
    }),
    db.skillLevel.findUnique({
      where: { skillId_level: { skillId: proof.skillId, level: proof.targetLevel + 1 } },
      select: { title: true },
    }),
    db.xpLedger.findFirst({ where: { userId: p.userId, refType: "proof", refId: proof.id, reason: "proof_passed" } }),
    getAccountLevelCurve(db),
    getRarityThresholds(db),
  ]);
  const xpAwarded = ledgerRow?.amount ?? 0;
  const totalAfter = ledgerRow
    ? ((await db.xpLedger.aggregate({ where: { userId: p.userId, createdAt: { lte: ledgerRow.createdAt } }, _sum: { amount: true } }))._sum.amount ?? 0)
    : 0;

  const [atOrAbove, all] = await Promise.all([
    db.userSkill.count({ where: { skillId: proof.skillId, level: { gte: proof.targetLevel } } }),
    db.userSkill.count({ where: { skillId: proof.skillId } }),
  ]);
  const topPercent = all > 0 ? Math.min(100, Math.max(1, Math.ceil((atOrAbove / all) * 100))) : 100;

  // Kỹ năng con vừa mở
  const childCandidates = proof.skill.skillEdgesParentSkill.filter(
    (e) => e.requiredLevel === proof.targetLevel && e.childSkill.status === "active",
  );
  const otherParentIds = [
    ...new Set(childCandidates.flatMap((e) => e.childSkill.skillEdgesChildSkill.map((x) => x.parentSkillId))),
  ];
  const myLevels = new Map(
    (
      await db.userSkill.findMany({
        where: { userId: p.userId, skillId: { in: otherParentIds } },
        select: { skillId: true, level: true },
      })
    ).map((r) => [r.skillId, r.level]),
  );
  const unlockedSkills = childCandidates
    .filter((e) => e.childSkill.skillEdgesChildSkill.every((x) => (myLevels.get(x.parentSkillId) ?? 0) >= x.requiredLevel))
    .map((e) => ({ slug: e.childSkill.slug, name: e.childSkill.name }));

  return {
    proofId: proof.id,
    skill: {
      slug: proof.skill.slug,
      name: proof.skill.name,
      category: proof.skill.category,
      maxLevel: proof.skill.maxLevel,
      rarity: rarityOf(proof.skill.holderCount, thresholds),
    },
    level: proof.targetLevel,
    levelTitle: level?.title ?? null,
    nextLevelTitle: proof.targetLevel < proof.skill.maxLevel ? (nextLevel?.title ?? null) : null,
    isMaxLevel: proof.targetLevel === proof.skill.maxLevel,
    xpAwarded,
    accountLevelBefore: accountLevelForXp(totalAfter - xpAwarded, curve.step),
    accountLevelAfter: accountLevelForXp(totalAfter, curve.step),
    passVotes: proof.reviews.filter((r) => r.verdict === "pass").length,
    totalVotes: proof.reviews.length,
    topPercent,
    badges: proof.userBadges.map((b) => b.badge),
    unlockedSkills,
    displayName: proof.user.displayName,
  };
}

export type ShareCard = {
  proofId: string;
  /** Chỉ tên hiển thị — không handle, không id, không email. */
  displayName: string;
  skill: { slug: string; name: string; category: { slug: string; name: string } };
  level: number;
  /** skill_levels.title của cấp đạt (vd. "Thành thạo"). */
  levelTitle: string | null;
  maxLevel: number;
  rarity: Rarity;
  verifiedCount: number;
  decidedAt: Date | null;
};

/** Dữ liệu công khai cho thẻ chia sẻ / trang /share/[proofId]. Chỉ bằng chứng đã đạt của tài khoản còn hoạt động. */
export async function getShareCard(db: Db, p: { proofId: string }): Promise<ShareCard> {
  const proof = await db.proof.findFirst({
    where: { id: p.proofId, status: "passed", deletedAt: null, user: { deletedAt: null, status: { not: "banned" } } },
    select: {
      id: true,
      skillId: true,
      targetLevel: true,
      decidedAt: true,
      user: { select: { displayName: true } },
      skill: { select: { slug: true, name: true, maxLevel: true, holderCount: true, category: { select: { slug: true, name: true } } } },
      reviews: { where: { verdict: "pass", assignment: { state: "done" } }, select: { id: true } },
    },
  });
  if (!proof) throw new DomainError("NOT_FOUND", "Không tìm thấy thành tích.");
  const thresholds = await getRarityThresholds(db);
  const level = await db.skillLevel.findUnique({
    where: { skillId_level: { skillId: proof.skillId, level: proof.targetLevel } },
    select: { title: true },
  });
  return {
    proofId: proof.id,
    displayName: proof.user.displayName,
    skill: { slug: proof.skill.slug, name: proof.skill.name, category: proof.skill.category },
    level: proof.targetLevel,
    levelTitle: level?.title ?? null,
    maxLevel: proof.skill.maxLevel,
    rarity: rarityOf(proof.skill.holderCount, thresholds),
    verifiedCount: proof.reviews.length,
    decidedAt: proof.decidedAt,
  };
}
