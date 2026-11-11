/**
 * Ghi sổ cái (chỉ INSERT) + cập nhật cache trên users trong CÙNG transaction của người gọi.
 * Nội bộ packages/domain — không export ra ngoài gói.
 */
import type { Tx, XpReason } from "@skillverse/db";
import { getAccountLevelCurve, getConfig } from "./config";
import { accountLevelForXp } from "./xp";

/** xp_ledger + users.total_xp / account_level. Trả cấp tài khoản trước/sau. */
export async function awardXp(
  tx: Tx,
  o: { userId: string; amount: number; reason: XpReason; skillId?: string | null; refType?: string; refId?: string | null; now: Date },
): Promise<{ totalXp: number; accountLevelBefore: number; accountLevel: number }> {
  await tx.xpLedger.create({
    data: {
      userId: o.userId,
      skillId: o.skillId ?? null,
      amount: o.amount,
      reason: o.reason,
      refType: o.refType ?? null,
      refId: o.refId ?? null,
      createdAt: o.now,
    },
  });
  const curve = await getAccountLevelCurve(tx);
  const u = await tx.user.update({
    where: { id: o.userId },
    data: { totalXp: { increment: o.amount } },
    select: { totalXp: true, accountLevel: true },
  });
  const accountLevel = accountLevelForXp(u.totalXp, curve.step);
  if (accountLevel !== u.accountLevel) {
    await tx.user.update({ where: { id: o.userId }, data: { accountLevel } });
  }
  return { totalXp: u.totalXp, accountLevelBefore: u.accountLevel, accountLevel };
}

/**
 * reputation_events + cache users.reputation. Cache kẹp [0, 100] (CHECK DB); sổ cái ghi delta
 * thực áp dụng để tổng sổ cái = cache (D49).
 */
export async function applyReputation(
  tx: Tx,
  o: { userId: string; delta: number; reason: string; refId: string | null; now: Date },
): Promise<number> {
  const u = await tx.user.findUniqueOrThrow({ where: { id: o.userId }, select: { reputation: true } });
  const next = Math.min(100, Math.max(0, u.reputation + o.delta));
  const applied = next - u.reputation;
  await tx.reputationEvent.create({
    data: { userId: o.userId, delta: applied, reason: o.reason, refId: o.refId, createdAt: o.now },
  });
  if (applied !== 0) await tx.user.update({ where: { id: o.userId }, data: { reputation: next } });
  return applied;
}

// ---------------------------------------------------------------------------
// Nhiệm vụ hằng ngày
// ---------------------------------------------------------------------------

export type DailyQuestDef = { key: string; title: string; target: number; xp: number };

/** Ngày nhiệm vụ theo giờ Việt Nam (UTC+7), biểu diễn bằng Date 00:00 UTC cho cột kiểu date. */
export function questDate(now: Date): Date {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Tăng tiến độ nhiệm vụ ngày; khi vừa đạt target → done_at + XP quest_done. */
export async function bumpDailyQuest(
  tx: Tx,
  o: { userId: string; questKey: string; now: Date },
): Promise<{ progress: number; target: number; completed: boolean; xpAwarded: number } | null> {
  const defs = await getConfig<DailyQuestDef[]>(tx, "daily_quests");
  const def = defs.find((d) => d.key === o.questKey);
  if (!def) return null;
  const date = questDate(o.now);
  const row = await tx.dailyQuest.upsert({
    where: { userId_date_questKey: { userId: o.userId, date, questKey: o.questKey } },
    update: { progress: { increment: 1 } },
    create: { userId: o.userId, date, questKey: o.questKey, progress: 1 },
  });
  if (row.progress >= def.target && !row.doneAt) {
    await tx.dailyQuest.update({
      where: { userId_date_questKey: { userId: o.userId, date, questKey: o.questKey } },
      data: { doneAt: o.now },
    });
    await awardXp(tx, { userId: o.userId, amount: def.xp, reason: "quest_done", refType: "daily_quest", now: o.now });
    return { progress: row.progress, target: def.target, completed: true, xpAwarded: def.xp };
  }
  return { progress: row.progress, target: def.target, completed: false, xpAwarded: 0 };
}
