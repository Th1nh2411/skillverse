import type { Prisma } from "@skillverse/db";
import { e2eDb } from "./db";

/**
 * Ghi CHUẨN BỊ dữ liệu trong DB e2e — chỉ hai loại được lead cho phép (giai đoạn 4):
 *  - hạ ngưỡng trong app_config (để không cần 50 người ủng hộ / 30 phiếu với 11 người dùng seed);
 *  - kéo `proposals.voting_ends_at` về quá khứ để /api/cron đóng đề xuất.
 * Mọi thay đổi nghiệp vụ khác vẫn đi qua ứng dụng. Global-setup seed lại DB mỗi lượt chạy.
 */
export async function setConfig(key: string, patch: Record<string, Prisma.InputJsonValue>): Promise<() => Promise<void>> {
  const db = e2eDb();
  const row = await db.appConfig.findUniqueOrThrow({ where: { key } });
  const original = row.value as Prisma.InputJsonObject;
  await db.appConfig.update({ where: { key }, data: { value: { ...original, ...patch } } });
  return async () => {
    await db.appConfig.update({ where: { key }, data: { value: original } });
  };
}

export async function expireVoting(proposalId: string): Promise<void> {
  await e2eDb().proposal.update({ where: { id: proposalId }, data: { votingEndsAt: new Date(Date.now() - 60_000) } });
}
