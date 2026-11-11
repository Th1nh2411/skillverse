/**
 * Nhiệm vụ hằng ngày + chuỗi ngày (streak). Định nghĩa nhiệm vụ trong app_config.daily_quests.
 * Ngày tính theo lịch Việt Nam (D56).
 */
import { getConfig } from "./config";
import { withTx, type Db } from "./db";
import { DomainError } from "./errors";
import { bumpDailyQuest, questDate, type DailyQuestDef } from "./ledger";

const DAY_MS = 86_400_000;

export type DailyQuestView = {
  key: string;
  title: string;
  target: number;
  progress: number;
  xp: number;
  done: boolean;
  doneAt: Date | null;
};

export type DailyQuests = {
  /** Ngày (00:00 UTC biểu diễn ngày lịch Việt Nam). */
  date: Date;
  quests: DailyQuestView[];
  completedCount: number;
  total: number;
  /** Số ngày liên tiếp có ít nhất một nhiệm vụ hoàn thành (tính cả hôm nay nếu đã xong; nếu chưa thì tính tới hôm qua). */
  streak: number;
  activeToday: boolean;
};

/** Chuỗi ngày liên tiếp có nhiệm vụ hoàn thành. */
export async function getStreak(db: Db, p: { userId: string; now?: Date }): Promise<{ streak: number; activeToday: boolean }> {
  const today = questDate(p.now ?? new Date());
  const rows = await db.dailyQuest.findMany({
    where: { userId: p.userId, doneAt: { not: null }, date: { lte: today } },
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: 400,
  });
  const days = new Set(rows.map((r) => r.date.getTime()));
  const activeToday = days.has(today.getTime());
  let cursor = activeToday ? today.getTime() : today.getTime() - DAY_MS;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return { streak, activeToday };
}

/** Nhiệm vụ hôm nay; tạo dòng daily_quests (progress 0) cho nhiệm vụ còn thiếu. */
export async function getDailyQuests(db: Db, p: { userId: string; now?: Date }): Promise<DailyQuests> {
  const now = p.now ?? new Date();
  const date = questDate(now);
  const defs = await getConfig<DailyQuestDef[]>(db, "daily_quests");
  await db.dailyQuest.createMany({
    data: defs.map((d) => ({ userId: p.userId, date, questKey: d.key, progress: 0 })),
    skipDuplicates: true,
  });
  const rows = await db.dailyQuest.findMany({ where: { userId: p.userId, date } });
  const byKey = new Map(rows.map((r) => [r.questKey, r]));
  const quests = defs.map((d) => {
    const r = byKey.get(d.key);
    return {
      key: d.key,
      title: d.title,
      target: d.target,
      progress: Math.min(r?.progress ?? 0, d.target),
      xp: d.xp,
      done: !!r?.doneAt,
      doneAt: r?.doneAt ?? null,
    };
  });
  const s = await getStreak(db, { userId: p.userId, now });
  return {
    date,
    quests,
    completedCount: quests.filter((q) => q.done).length,
    total: quests.length,
    streak: s.streak,
    activeToday: s.activeToday,
  };
}

/**
 * Tăng tiến độ một nhiệm vụ (vd. "practice_10min" khi người dùng ghi nhận luyện tập).
 * Khi đạt target lần đầu trong ngày → done_at + XP quest_done (xp_ledger) trong cùng transaction.
 */
export async function progressQuest(
  db: Db,
  p: { userId: string; questKey: string; amount?: number; now?: Date },
): Promise<{ progress: number; target: number; completed: boolean; xpAwarded: number }> {
  const now = p.now ?? new Date();
  return withTx(db, async (tx) => {
    const r = await bumpDailyQuest(tx, { userId: p.userId, questKey: p.questKey, amount: p.amount, now });
    if (!r) throw new DomainError("BAD_REQUEST", "Nhiệm vụ không tồn tại.");
    return r;
  });
}
