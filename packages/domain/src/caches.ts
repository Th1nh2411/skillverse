/**
 * Tính lại cache từ sổ cái (DATA_MODEL mục 1.3): users.total_xp, users.account_level, users.reputation,
 * user_skills.xp. Sổ cái (xp_ledger, reputation_events) chỉ đọc, không sửa.
 */
import { getAccountLevelCurve } from "./config";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { accountLevelForXp } from "./xp";

/**
 * Uy tín khởi đầu = DEFAULT của cột users.reputation (db/schema.sql: 50). Mọi thay đổi sau đó nằm trong
 * reputation_events (seed ghi delta = reputation − 50).
 */
export const INITIAL_REPUTATION = 50;

export type UserCacheValues = {
  totalXp: number;
  accountLevel: number;
  reputation: number;
  /** skillId → xp (chỉ các kỹ năng có user_skills). */
  skillXp: Record<string, number>;
};

export type RecomputeResult = {
  userId: string;
  before: UserCacheValues;
  expected: UserCacheValues;
  /** Các trường lệch (vd. "totalXp", "skillXp:<skillId>"). Rỗng = khớp. */
  mismatches: string[];
  applied: boolean;
};

/**
 * So cache với sổ cái; `apply` (mặc định true) ghi lại giá trị đúng trong một transaction.
 * xp theo kỹ năng = tổng xp_ledger có skill_id đó với lý do proof_passed / revoked.
 */
export async function recomputeUserCaches(
  db: Db,
  p: { userId: string; apply?: boolean },
): Promise<RecomputeResult> {
  const apply = p.apply ?? true;
  return withTx(db, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: p.userId },
      select: { totalXp: true, accountLevel: true, reputation: true },
    });
    if (!user) throw new DomainError("NOT_FOUND", "Không tìm thấy người dùng.");
    const curve = await getAccountLevelCurve(tx);
    const xpSum = (await tx.xpLedger.aggregate({ where: { userId: p.userId }, _sum: { amount: true } }))._sum.amount ?? 0;
    const repSum = (await tx.reputationEvent.aggregate({ where: { userId: p.userId }, _sum: { delta: true } }))._sum.delta ?? 0;
    const perSkill = await tx.xpLedger.groupBy({
      by: ["skillId"],
      where: { userId: p.userId, skillId: { not: null }, reason: { in: ["proof_passed", "revoked"] } },
      _sum: { amount: true },
    });
    const userSkills = await tx.userSkill.findMany({ where: { userId: p.userId }, select: { skillId: true, xp: true } });

    const before: UserCacheValues = {
      totalXp: user.totalXp,
      accountLevel: user.accountLevel,
      reputation: user.reputation,
      skillXp: Object.fromEntries(userSkills.map((u) => [u.skillId, u.xp])),
    };
    const ledgerSkill = new Map(perSkill.map((r) => [r.skillId!, r._sum.amount ?? 0]));
    const expected: UserCacheValues = {
      totalXp: xpSum,
      accountLevel: accountLevelForXp(xpSum, curve.step),
      reputation: Math.min(100, Math.max(0, INITIAL_REPUTATION + repSum)),
      skillXp: Object.fromEntries(userSkills.map((u) => [u.skillId, Math.max(0, ledgerSkill.get(u.skillId) ?? 0)])),
    };

    const mismatches: string[] = [];
    for (const k of ["totalXp", "accountLevel", "reputation"] as const) if (before[k] !== expected[k]) mismatches.push(k);
    for (const [skillId, xp] of Object.entries(expected.skillXp)) {
      if (before.skillXp[skillId] !== xp) mismatches.push(`skillXp:${skillId}`);
    }

    if (apply && mismatches.length > 0) {
      await tx.user.update({
        where: { id: p.userId },
        data: { totalXp: expected.totalXp, accountLevel: expected.accountLevel, reputation: expected.reputation },
      });
      for (const [skillId, xp] of Object.entries(expected.skillXp)) {
        if (before.skillXp[skillId] !== xp) {
          await tx.userSkill.update({ where: { userId_skillId: { userId: p.userId, skillId } }, data: { xp } });
        }
      }
    }
    return { userId: p.userId, before, expected, mismatches, applied: apply && mismatches.length > 0 };
  });
}

/** Rà toàn bộ người dùng (tác vụ quản trị / kiểm tra); trả danh sách người lệch. */
export async function recomputeAllUserCaches(
  db: Db,
  p: { apply?: boolean } = {},
): Promise<{ checked: number; mismatched: RecomputeResult[] }> {
  const users = await db.user.findMany({ select: { id: true } });
  const mismatched: RecomputeResult[] = [];
  for (const u of users) {
    const r = await recomputeUserCaches(db, { userId: u.id, apply: p.apply ?? false });
    if (r.mismatches.length > 0) mismatched.push(r);
  }
  return { checked: users.length, mismatched };
}
