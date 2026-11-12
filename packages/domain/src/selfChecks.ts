/**
 * Tự đánh dấu mốc (D73): tiến độ cá nhân trong `milestone_checks`, không cần video.
 * KHÔNG ghi `user_skills.level` (level đã xác thực chỉ đổi trong finalizeProof). Không XP, không uy tín (chống cày).
 * Điều kiện người duyệt, XP, huy hiệu, trọng số phiếu vẫn chỉ dựa trên level đã xác thực.
 */
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { milestoneLabel } from "./milestones";

/**
 * Bắt đầu theo một kỹ năng (giống onboarding): tạo user_skills (level mặc định 0 của cột — KHÔNG đặt level)
 * và skill_follows nếu chưa có. Idempotent.
 */
export async function ensurePracticing(tx: Db, userId: string, skillIds: string[]): Promise<void> {
  if (skillIds.length === 0) return;
  await tx.userSkill.createMany({ data: skillIds.map((skillId) => ({ userId, skillId })), skipDuplicates: true });
  await tx.skillFollow.createMany({ data: skillIds.map((skillId) => ({ userId, skillId })), skipDuplicates: true });
}

/**
 * selfLevel = mốc L cao nhất sao cho mọi mốc 1..L đều đã tự đánh dấu HOẶC đã xác thực (≤ level).
 * Vì vậy selfLevel ≥ level đã xác thực, và tiến độ hiển thị = max(selfLevel, level) = selfLevel.
 */
export function computeSelfLevel(verifiedLevel: number, checkedLevels: Iterable<number>, maxLevel: number): number {
  const checked = new Set(checkedLevels);
  let l = 0;
  while (l < maxLevel && (l + 1 <= verifiedLevel || checked.has(l + 1))) l++;
  return Math.max(l, Math.min(verifiedLevel, maxLevel));
}

export type SelfProgress = {
  /** Các mốc (số cấp) người dùng đã tự đánh dấu. */
  checked(skillId: string): Set<number>;
  selfLevel(skillId: string, verifiedLevel: number, maxLevel: number): number;
};

/** Nạp mốc đã tự đánh dấu của một người cho các kỹ năng (một truy vấn). userId null → rỗng. */
export async function loadSelfProgress(db: Db, userId: string | null | undefined, skillIds: string[]): Promise<SelfProgress> {
  const map = new Map<string, Set<number>>();
  if (userId && skillIds.length > 0) {
    const rows = await db.milestoneCheck.findMany({
      where: { userId, skillLevel: { skillId: { in: [...new Set(skillIds)] } } },
      select: { skillLevel: { select: { skillId: true, level: true } } },
    });
    for (const r of rows) {
      const s = map.get(r.skillLevel.skillId) ?? new Set<number>();
      s.add(r.skillLevel.level);
      map.set(r.skillLevel.skillId, s);
    }
  }
  const checked = (skillId: string) => map.get(skillId) ?? new Set<number>();
  return {
    checked,
    selfLevel: (skillId, verifiedLevel, maxLevel) => computeSelfLevel(verifiedLevel, checked(skillId), maxLevel),
  };
}

export type MilestoneCheckResult = {
  skillId: string;
  /** Mốc vừa đánh dấu / bỏ đánh dấu. */
  level: number;
  checked: boolean;
  /** Level đã xác thực (user_skills.level) — không đổi bởi thao tác này. */
  verifiedLevel: number;
  selfLevel: number;
};

async function loadState(tx: Db, userId: string, skillLevelId: string) {
  const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { status: true } });
  if (!user) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
  if (user.status === "banned") throw new DomainError("FORBIDDEN", "Tài khoản đã bị khóa.");
  const sl = await tx.skillLevel.findUnique({
    where: { id: skillLevelId },
    select: { id: true, level: true, skillId: true, skill: { select: { status: true, maxLevel: true } } },
  });
  if (!sl || sl.skill.status !== "active") throw new DomainError("NOT_FOUND", "Không tìm thấy mốc kỹ năng.");
  const us = await tx.userSkill.findUnique({
    where: { userId_skillId: { userId, skillId: sl.skillId } },
    select: { level: true },
  });
  const verifiedLevel = us?.level ?? 0;
  const progress = await loadSelfProgress(tx, userId, [sl.skillId]);
  return { sl, verifiedLevel, checked: progress.checked(sl.skillId) };
}

/**
 * Tự đánh dấu một mốc. Phải theo thứ tự: mốc trước đó đã đánh dấu hoặc đã xác thực.
 * Tự theo dõi kỹ năng (ensurePracticing). Mốc đã xác thực / đã đánh dấu → không làm gì (idempotent).
 * Không XP, không uy tín, không ghi level.
 */
export async function checkMilestone(
  db: Db,
  p: { userId: string; skillLevelId: string; now?: Date },
): Promise<MilestoneCheckResult> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const { sl, verifiedLevel, checked } = await loadState(tx, p.userId, p.skillLevelId);
    const max = sl.skill.maxLevel;
    const current = computeSelfLevel(verifiedLevel, checked, max);
    if (sl.level > current + 1) {
      const titles = await tx.skillLevel.findUnique({
        where: { skillId_level: { skillId: sl.skillId, level: current + 1 } },
        select: { title: true },
      });
      throw new DomainError("PRECONDITION_FAILED", `Hãy hoàn thành ${milestoneLabel(titles?.title, current + 1)} trước.`);
    }
    await ensurePracticing(tx, p.userId, [sl.skillId]);
    if (sl.level > verifiedLevel && !checked.has(sl.level)) {
      await tx.milestoneCheck.createMany({
        data: [{ userId: p.userId, skillLevelId: sl.id, createdAt: now }],
        skipDuplicates: true,
      });
      checked.add(sl.level);
    }
    return {
      skillId: sl.skillId,
      level: sl.level,
      checked: true,
      verifiedLevel,
      selfLevel: computeSelfLevel(verifiedLevel, checked, max),
    };
  });
}

/**
 * Bỏ đánh dấu: chỉ mốc tự đánh dấu cao nhất, và không thể bỏ mốc ≤ level đã xác thực.
 */
export async function uncheckMilestone(
  db: Db,
  p: { userId: string; skillLevelId: string },
): Promise<MilestoneCheckResult> {
  return withTx(db, async (tx) => {
    const { sl, verifiedLevel, checked } = await loadState(tx, p.userId, p.skillLevelId);
    if (sl.level <= verifiedLevel) {
      throw new DomainError("PRECONDITION_FAILED", "Mốc này đã được cộng đồng xác thực, không bỏ đánh dấu được.");
    }
    if (!checked.has(sl.level)) throw new DomainError("NOT_FOUND", "Mốc này chưa được đánh dấu.");
    if (Math.max(...checked) !== sl.level) {
      throw new DomainError("PRECONDITION_FAILED", "Chỉ bỏ đánh dấu được mốc cao nhất.");
    }
    await tx.milestoneCheck.delete({ where: { userId_skillLevelId: { userId: p.userId, skillLevelId: sl.id } } });
    checked.delete(sl.level);
    return {
      skillId: sl.skillId,
      level: sl.level,
      checked: false,
      verifiedLevel,
      selfLevel: computeSelfLevel(verifiedLevel, checked, sl.skill.maxLevel),
    };
  });
}
