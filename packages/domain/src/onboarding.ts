import type { SelfLevel } from "@skillverse/validation";
import { ONBOARDING_MIN_SKILLS } from "@skillverse/validation";
import type { Db } from "./db";
import { withTx } from "./db";
import { listCategories, rarestSkills, type SkillSummary } from "./discover";
import { DomainError } from "./errors";
import { getRarityThresholds } from "./config";
import { rarityOf } from "./rarity";
import type { CriterionView } from "./skills";

export type OnboardingOptions = {
  minSkills: number;
  categories: { id: string; slug: string; name: string; skillCount: number }[];
  /** Kỹ năng phổ biến (holder_count giảm dần) để chọn nhanh. */
  popularSkills: SkillSummary[];
  /** Vài kỹ năng hiếm để gợi tò mò. */
  rareSkills: SkillSummary[];
};

export async function getOnboardingOptions(db: Db, input: { limit?: number } = {}): Promise<OnboardingOptions> {
  const [categories, popular, rare, thresholds] = await Promise.all([
    listCategories(db),
    db.skill.findMany({
      where: { status: "active" },
      orderBy: [{ holderCount: "desc" }, { name: "asc" }],
      take: input.limit ?? 12,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        riskLevel: true,
        maxLevel: true,
        holderCount: true,
        category: { select: { slug: true, name: true } },
      },
    }),
    rarestSkills(db, { limit: 4 }),
    getRarityThresholds(db),
  ]);
  return {
    minSkills: ONBOARDING_MIN_SKILLS,
    categories,
    popularSkills: popular.map((s) => ({ ...s, rarity: rarityOf(s.holderCount, thresholds) })),
    rareSkills: rare,
  };
}

export type FirstChallenge = {
  skillId: string;
  slug: string;
  name: string;
  /** Cấp kế tiếp hợp lệ để nộp (= level hiện tại + 1). */
  targetLevel: number;
  levelTitle: string | null;
  xpReward: number;
  criteria: CriterionView[];
};

const SELF_RANK: Record<SelfLevel, number> = { proficient: 0, some: 1, beginner: 2 };

/**
 * Hoàn tất onboarding: tạo user_skills (level mặc định 0) cho kỹ năng chưa có, theo dõi kỹ năng,
 * đặt onboarded_at. `selfLevels` CHỈ dùng chọn thử thách gợi ý — KHÔNG ghi vào level.
 * Gọi lại nhiều lần an toàn (idempotent).
 */
export async function completeOnboarding(
  db: Db,
  input: { userId: string; skillIds: string[]; selfLevels?: Record<string, SelfLevel> },
): Promise<{ firstChallenge: FirstChallenge | null }> {
  const skillIds = [...new Set(input.skillIds)];
  if (skillIds.length < ONBOARDING_MIN_SKILLS) {
    throw new DomainError("BAD_REQUEST", `Chọn ít nhất ${ONBOARDING_MIN_SKILLS} kỹ năng.`);
  }

  return withTx(db, async (tx) => {
    const user = await tx.user.findFirst({ where: { id: input.userId, deletedAt: null }, select: { id: true, onboardedAt: true } });
    if (!user) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");

    const skills = await tx.skill.findMany({
      where: { id: { in: skillIds }, status: "active" },
      include: {
        skillEdgesChildSkill: true,
        skillLevels: {
          orderBy: { level: "asc" },
          include: { currentVersion: { include: { criteria: { orderBy: { position: "asc" } } } } },
        },
      },
    });
    if (skills.length !== skillIds.length) {
      throw new DomainError("BAD_REQUEST", "Có kỹ năng không tồn tại hoặc chưa mở.");
    }

    // Không đặt `level` — dùng mặc định 0 của cột; level chỉ đổi trong finalizeProof().
    await tx.userSkill.createMany({
      data: skillIds.map((skillId) => ({ userId: user.id, skillId })),
      skipDuplicates: true,
    });
    await tx.skillFollow.createMany({
      data: skillIds.map((skillId) => ({ userId: user.id, skillId })),
      skipDuplicates: true,
    });
    if (!user.onboardedAt) {
      await tx.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
    }

    // Chọn thử thách đầu tiên.
    const parentIds = skills.flatMap((s) => s.skillEdgesChildSkill.map((e) => e.parentSkillId));
    const mine = await tx.userSkill.findMany({
      where: { userId: user.id, skillId: { in: [...new Set([...skillIds, ...parentIds])] } },
      select: { skillId: true, level: true },
    });
    const lv = new Map(mine.map((m) => [m.skillId, m.level]));
    const order = new Map(skillIds.map((id, i) => [id, i]));
    const candidates = skills
      .filter((s) => (lv.get(s.id) ?? 0) < s.maxLevel)
      .filter((s) => s.skillEdgesChildSkill.every((e) => (lv.get(e.parentSkillId) ?? 0) >= e.requiredLevel))
      .sort((a, b) => {
        const ra = SELF_RANK[input.selfLevels?.[a.id] ?? "beginner"];
        const rb = SELF_RANK[input.selfLevels?.[b.id] ?? "beginner"];
        return ra - rb || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
      });
    const pick = candidates[0];
    if (!pick) return { firstChallenge: null };
    const targetLevel = (lv.get(pick.id) ?? 0) + 1;
    const level = pick.skillLevels.find((l) => l.level === targetLevel);
    if (!level) return { firstChallenge: null };
    return {
      firstChallenge: {
        skillId: pick.id,
        slug: pick.slug,
        name: pick.name,
        targetLevel,
        levelTitle: level.title,
        xpReward: level.xpReward,
        criteria: (level.currentVersion?.criteria ?? []).map((c) => ({
          id: c.id,
          position: c.position,
          text: c.text,
          kind: c.kind,
          threshold: c.threshold ? c.threshold.toNumber() : null,
        })),
      },
    };
  });
}
