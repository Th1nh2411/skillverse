/**
 * Tác vụ nền (chạy qua JobRunner từ /api/cron). Tất cả idempotent.
 */
import { getConfig, type ReputationDeltas } from "./config";
import { withTx, type Db } from "./db";
import type { JobHandler, JobName } from "./jobs";
import { applyReputation } from "./ledger";
import { closeDuels } from "./challenges";
import { expireOverdueAssignments } from "./proofs";

const DAY_MS = 86_400_000;

/** Phân công quá hạn → expired, gán người khác (tên job: reassignExpiredReviews). */
export function reassignExpiredReviews(db: Db, p: { now?: Date; rng?: () => number } = {}) {
  return expireOverdueAssignments(db, p);
}

/**
 * +weekly_recovery uy tín cho người đang dưới reviewer_min_reputation, nếu 7 ngày qua không có
 * sự kiện uy tín âm, không bị xử phạt, và chưa được cộng weekly_recovery trong 7 ngày qua (idempotent).
 */
export async function weeklyReputationRecovery(db: Db, p: { now?: Date } = {}): Promise<{ recovered: number }> {
  const now = p.now ?? new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const minRep = await getConfig<number>(db, "reviewer_min_reputation");
  const deltas = await getConfig<ReputationDeltas>(db, "reputation_deltas");
  const users = await db.user.findMany({
    where: {
      reputation: { lt: minRep },
      deletedAt: null,
      status: { not: "banned" },
      reputationEvents: {
        none: { createdAt: { gte: weekAgo }, OR: [{ delta: { lt: 0 } }, { reason: "weekly_recovery" }] },
      },
      sanctionsUser: { none: { startsAt: { gte: weekAgo } } },
    },
    select: { id: true },
  });
  let recovered = 0;
  for (const u of users) {
    await withTx(db, async (tx) => {
      // Kiểm tra lại trong transaction để chạy song song hai lần vẫn không cộng đôi.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${u.id}::uuid FOR NO KEY UPDATE`;
      const again = await tx.reputationEvent.count({
        where: { userId: u.id, reason: "weekly_recovery", createdAt: { gte: weekAgo } },
      });
      if (again > 0) return;
      await applyReputation(tx, { userId: u.id, delta: deltas.weekly_recovery, reason: "weekly_recovery", refId: null, now });
      recovered += 1;
    });
  }
  return { recovered };
}

/** Handler domain cho InlineJobRunner. closeExpiredProposals chưa có (giai đoạn góp ý) → no-op. */
export function createDomainJobHandlers(db: Db): Partial<Record<JobName, JobHandler>> {
  return {
    reassignExpiredReviews: () => reassignExpiredReviews(db),
    weeklyReputationRecovery: () => weeklyReputationRecovery(db),
    closeExpiredProposals: async () => ({ closed: 0 }),
    closeDuels: () => closeDuels(db),
  };
}
