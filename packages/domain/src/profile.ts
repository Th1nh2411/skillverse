import { getAccountLevelCurve, getRarityThresholds } from "./config";
import type { Db } from "./db";
import { DomainError } from "./errors";
import { rarityOf, rarityRank, type Rarity } from "./rarity";
import { xpProgress, type XpProgress } from "./xp";

export type FeaturedSkill = {
  skillId: string;
  slug: string;
  name: string;
  category: { slug: string; name: string };
  level: number;
  maxLevel: number;
  holderCount: number;
  rarity: Rarity;
  /** Số người duyệt khác nhau đã chấm đạt các bằng chứng đã đạt của người này ở kỹ năng này. */
  verifiedByCount: number;
  /** Bằng chứng đang chờ duyệt (pending / in_review / disputed), nếu có. */
  pendingTargetLevel: number | null;
};

export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
  isEditor: boolean;
  reputation: number;
  xp: XpProgress;
  stats: {
    /** Số kỹ năng đang theo (mọi user_skills, kể cả cấp 0 — D65). */
    skillCount: number;
    /** Số kỹ năng đạt cấp ≥ 1 mà kỹ năng đó Hiếm/Huyền thoại (huy hiệu vải hiếm). */
    rareBadgeCount: number;
    /** Số thử thách đã tham gia. */
    challengeCount: number;
    followerCount: number;
    followingCount: number;
  };
  /** Danh mục có nhiều kỹ năng nhất (tối đa 3). */
  topCategories: { slug: string; name: string }[];
  /** Sắp theo độ hiếm (huyền thoại trước) rồi cấp giảm dần. */
  featuredSkills: FeaturedSkill[];
  /** Người xem đang theo dõi người này (false nếu là chính mình / chưa đăng nhập). */
  viewerFollows: boolean;
  onboarded: boolean;
};

export async function getProfile(
  db: Db,
  input: { handle?: string; userId?: string; viewerId?: string | null; featuredLimit?: number },
): Promise<Profile> {
  if (!input.handle && !input.userId) throw new DomainError("BAD_REQUEST", "Thiếu người dùng cần xem.");
  const user = await db.user.findFirst({
    where: { ...(input.userId ? { id: input.userId } : { handle: input.handle }), deletedAt: null },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      isEditor: true,
      reputation: true,
      totalXp: true,
      onboardedAt: true,
    },
  });
  if (!user) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");

  const [curve, thresholds] = await Promise.all([getAccountLevelCurve(db), getRarityThresholds(db)]);

  const [userSkills, pending, challengeCount, followerCount, followingCount, viewerFollow] = await Promise.all([
    db.userSkill.findMany({
      where: { userId: user.id, skill: { status: "active" } },
      select: {
        level: true,
        skill: {
          select: {
            id: true,
            slug: true,
            name: true,
            maxLevel: true,
            holderCount: true,
            category: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    db.proof.findMany({
      where: { userId: user.id, status: { in: ["pending", "in_review", "disputed"] }, deletedAt: null },
      select: { skillId: true, targetLevel: true },
    }),
    db.challengeEntry.count({ where: { userId: user.id } }),
    db.follow.count({ where: { followeeId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    input.viewerId && input.viewerId !== user.id
      ? db.follow.count({ where: { followerId: input.viewerId, followeeId: user.id } })
      : Promise.resolve(0),
  ]);

  const pendingBySkill = new Map(pending.map((p) => [p.skillId, p.targetLevel]));

  // Người duyệt đạt (khác nhau) trên các bằng chứng đã đạt, theo kỹ năng.
  const passReviews = await db.review.findMany({
    where: { verdict: "pass", proof: { userId: user.id, status: "passed", deletedAt: null } },
    select: { reviewerId: true, proof: { select: { skillId: true } } },
  });
  const verifiers = new Map<string, Set<string>>();
  for (const r of passReviews) {
    const set = verifiers.get(r.proof.skillId) ?? new Set<string>();
    set.add(r.reviewerId);
    verifiers.set(r.proof.skillId, set);
  }

  const featured: FeaturedSkill[] = userSkills
    .filter((us) => us.level >= 1 || pendingBySkill.has(us.skill.id))
    .map((us) => ({
      skillId: us.skill.id,
      slug: us.skill.slug,
      name: us.skill.name,
      category: us.skill.category,
      level: us.level,
      maxLevel: us.skill.maxLevel,
      holderCount: us.skill.holderCount,
      rarity: rarityOf(us.skill.holderCount, thresholds),
      verifiedByCount: verifiers.get(us.skill.id)?.size ?? 0,
      pendingTargetLevel: pendingBySkill.get(us.skill.id) ?? null,
    }))
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || b.level - a.level || a.name.localeCompare(b.name));

  const achieved = featured.filter((f) => f.level >= 1);
  const catCount = new Map<string, { slug: string; name: string; n: number }>();
  for (const f of achieved) {
    const c = catCount.get(f.category.slug) ?? { ...f.category, n: 0 };
    c.n += 1;
    catCount.set(f.category.slug, c);
  }

  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isMe: !!input.viewerId && input.viewerId === user.id,
    isEditor: user.isEditor,
    reputation: user.reputation,
    xp: xpProgress(user.totalXp, curve.step),
    stats: {
      skillCount: userSkills.length,
      rareBadgeCount: achieved.filter((f) => f.rarity !== null).length,
      challengeCount,
      followerCount,
      followingCount,
    },
    topCategories: [...catCount.values()]
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map(({ slug, name }) => ({ slug, name })),
    featuredSkills: featured.slice(0, input.featuredLimit ?? 6),
    viewerFollows: viewerFollow > 0,
    onboarded: user.onboardedAt !== null,
  };
}

export type UserSkillItem = {
  skillId: string;
  slug: string;
  name: string;
  level: number;
  maxLevel: number;
  category: { slug: string; name: string };
  rarity: Rarity;
};

/**
 * Toàn bộ kỹ năng đã đạt cấp ≥ 1 của một người (không cắt như featuredSkills) — dùng cho đề nghị trao đổi
 * ("Bạn dạy / Họ dạy"). Sắp theo cấp giảm dần rồi tên.
 */
export async function listUserSkills(db: Db, input: { handle?: string; userId?: string }): Promise<UserSkillItem[]> {
  if (!input.handle && !input.userId) throw new DomainError("BAD_REQUEST", "Thiếu người dùng cần xem.");
  const user = await db.user.findFirst({
    where: { ...(input.userId ? { id: input.userId } : { handle: input.handle }), deletedAt: null, status: { not: "banned" } },
    select: { id: true },
  });
  if (!user) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
  const [rows, thresholds] = await Promise.all([
    db.userSkill.findMany({
      where: { userId: user.id, level: { gte: 1 }, skill: { status: "active" } },
      select: {
        level: true,
        skill: {
          select: { id: true, slug: true, name: true, maxLevel: true, holderCount: true, category: { select: { slug: true, name: true } } },
        },
      },
    }),
    getRarityThresholds(db),
  ]);
  return rows
    .map((r) => ({
      skillId: r.skill.id,
      slug: r.skill.slug,
      name: r.skill.name,
      level: r.level,
      maxLevel: r.skill.maxLevel,
      category: r.skill.category,
      rarity: rarityOf(r.skill.holderCount, thresholds),
    }))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "vi"));
}
