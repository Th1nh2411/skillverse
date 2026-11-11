/**
 * POST /api/cron — tác vụ định kỳ (gán lại phân công quá hạn, đóng đề xuất hết hạn, hồi uy tín tuần).
 * Bảo vệ bằng CRON_SECRET: header `Authorization: Bearer <secret>` hoặc `x-cron-secret`.
 * Gọi bởi .github/workflows/cron.yml mỗi 10 phút.
 */
import { NextResponse } from "next/server";
import { runCron, verifyCronSecret } from "@skillverse/api";
import { getPrisma } from "@skillverse/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!verifyCronSecret(req.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const jobs = await runCron(getPrisma());
  const ok = Object.values(jobs).every((j) => j.ok);
  return NextResponse.json({ ok, tookMs: Date.now() - startedAt, jobs }, { status: ok ? 200 : 500 });
}
