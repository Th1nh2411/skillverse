/**
 * Tác vụ định kỳ cho POST /api/cron (GitHub Actions gọi mỗi 10 phút). Chạy qua JobRunner của domain
 * để sau này thay bằng hàng đợi thật mà không sửa logic. Mọi handler domain đều idempotent
 * (vd. hồi uy tín tối đa 1 lần / 7 ngày).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@skillverse/db";
import { createDomainJobHandlers, InlineJobRunner, type JobHandler, type JobName } from "@skillverse/domain";

/** So khớp secret trong `Authorization: Bearer <s>` hoặc `x-cron-secret`, thời gian hằng. */
export function verifyCronSecret(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const auth = headers.get("authorization");
  const bearer = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim())?.[1] : undefined;
  const provided = bearer || headers.get("x-cron-secret");
  if (!provided) return false;
  // Băm trước để hai chuỗi luôn cùng độ dài (timingSafeEqual yêu cầu).
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export const CRON_JOBS: JobName[] = [
  "reassignExpiredReviews",
  "closeDuels",
  "closeExpiredProposals",
  "weeklyReputationRecovery",
];

export type CronReport = Partial<Record<JobName, { ok: boolean; result?: unknown; error?: string }>>;

export async function runCron(
  db: PrismaClient,
  handlers: Partial<Record<JobName, JobHandler>> = createDomainJobHandlers(db),
): Promise<CronReport> {
  const report: CronReport = {};
  // Bọc handler để ghi lại kết quả cho phản hồi HTTP.
  const wrapped = Object.fromEntries(
    Object.entries(handlers).map(([name, h]) => [
      name,
      async (payload?: unknown) => {
        report[name as JobName] = { ok: true, result: await h!(payload) };
      },
    ]),
  ) as Partial<Record<JobName, JobHandler>>;
  const runner = new InlineJobRunner(wrapped);
  for (const name of CRON_JOBS) {
    try {
      await runner.enqueue(name);
    } catch (e) {
      // Một tác vụ lỗi không chặn các tác vụ khác.
      report[name] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return report;
}
