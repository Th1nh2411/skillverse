import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { closeE2eDb, e2eDb, proofRow, userSkillLevel } from "./helpers/db";
import { uniqueVideo } from "./helpers/proof";
import { devToken, skipIfNoProcedure, trpcMutation, trpcQuery } from "./helpers/trpc";
import { recordCounts, reviewAllViaApi, submitProofViaApi } from "./helpers/verification";

/**
 * Q3.2 — Thu hồi level (DECISIONS D40, D59):
 * ngoclan (Tung hứng cấp 3; seed lanphuong đang có bằng chứng chờ duyệt nên không dùng) có bằng chứng cấp 4 đã đạt
 * (qua API, 3 người duyệt Đạt) → quocbao báo cáo "không phải chính người đăng" → bientap (biên tập viên) xác nhận
 * → level về 3, proof removed, sanction level_revoked, xp_ledger dòng âm "revoked",
 *   mỗi người duyệt Đạt nhận reputation_events approved_fraud −15, cache khớp sổ cái, KHÔNG xóa bản ghi nào.
 */
test.describe.serial("Báo cáo bằng chứng đã đạt → biên tập viên xác nhận → thu hồi level", () => {
  const SUBMITTER = "ngoclan";
  const SKILL = "tung-hung";
  let proofId = "";
  let reviewers: string[] = [];
  let reportId = "";
  let before: Awaited<ReturnType<typeof recordCounts>>;
  const repBefore = new Map<string, number>();

  test.afterAll(async () => {
    await closeE2eDb();
  });

  test("chuẩn bị: bằng chứng cấp 4 đã đạt", async ({ request }, testInfo) => {
    expect(await userSkillLevel(SUBMITTER, SKILL)).toBe(3);
    proofId = await submitProofViaApi(request, { handle: SUBMITTER, skillSlug: SKILL, targetLevel: 4, file: uniqueVideo(testInfo) });
    reviewers = await reviewAllViaApi(request, proofId, "pass");
    await expect.poll(async () => (await proofRow(proofId))?.status).toBe("passed");
    expect(await userSkillLevel(SUBMITTER, SKILL)).toBe(4);
  });

  test("báo cáo bằng chứng đã đạt", async ({ request }) => {
    test.skip(!proofId, "Bước chuẩn bị chưa chạy được");
    const token = await devToken(request, "quocbao");
    const r = await trpcMutation(request, token, "report.create", {
      targetType: "proof",
      targetId: proofId,
      reason: "not_self",
      details: "Người trong video không phải chủ tài khoản.",
    });
    skipIfNoProcedure(r, "report.create");
    expect(r.status, r.raw.slice(0, 300)).toBe(200);
    const row = await e2eDb().report.findFirstOrThrow({ where: { targetId: proofId, targetType: "proof" }, select: { id: true, status: true } });
    reportId = row.id;
    expect(row.status).toBe("open");
    // Báo cáo không tự đổi level
    expect(await userSkillLevel(SUBMITTER, SKILL)).toBe(4);
  });

  test("người thường không xử lý được báo cáo (admin.* FORBIDDEN)", async ({ request }) => {
    test.skip(!reportId, "Chưa có báo cáo");
    const token = await devToken(request, "minhhoang");
    const list = await trpcQuery(request, token, "admin.reports", {});
    expect(list.status).toBe(403);
    const resolve = await trpcMutation(request, token, "admin.resolveReport", { reportId, decision: "confirmed" });
    expect(resolve.status).toBe(403);
    expect(await userSkillLevel(SUBMITTER, SKILL)).toBe(4);
  });

  test("biên tập viên xác nhận → thu hồi level", async ({ request }) => {
    test.skip(!reportId, "Chưa có báo cáo");
    before = await recordCounts();
    for (const h of reviewers) {
      const u = await e2eDb().user.findUniqueOrThrow({ where: { handle: h }, select: { reputation: true } });
      repBefore.set(h, u.reputation);
    }
    const token = await devToken(request, "bientap");
    const list = await trpcQuery(request, token, "admin.reports", {});
    expect(list.status).toBe(200);
    expect(list.raw, "Danh sách báo cáo của biên tập viên phải có báo cáo này").toContain(reportId);

    const res = await trpcMutation(request, token, "admin.resolveReport", { reportId, decision: "confirmed", outcome: "Xác nhận gian lận (e2e)" });
    expect(res.status, res.raw.slice(0, 300)).toBe(200);

    const db = e2eDb();
    // Level hạ về target − 1
    expect(await userSkillLevel(SUBMITTER, SKILL)).toBe(3);
    const proof = await proofRow(proofId);
    expect(proof?.status).toBe("removed");
    const report = await db.report.findUniqueOrThrow({ where: { id: reportId }, select: { status: true } });
    expect(report.status).toBe("confirmed");

    const submitter = await db.user.findUniqueOrThrow({ where: { handle: SUBMITTER }, select: { id: true, totalXp: true } });
    const sanction = await db.sanction.findFirst({ where: { userId: submitter.id, kind: "level_revoked", proofId } });
    expect(sanction, "Thiếu sanctions(level_revoked, proof_id)").not.toBeNull();

    // XP: dòng âm "revoked" bù đúng XP đã cộng, cache total_xp = tổng sổ cái
    const earned = await db.xpLedger.findFirstOrThrow({ where: { userId: submitter.id, refId: proofId, reason: "proof_passed" } });
    const revoked = await db.xpLedger.findFirst({ where: { userId: submitter.id, refId: proofId, reason: "revoked" } });
    expect(revoked, "Thiếu dòng xp_ledger reason=revoked").not.toBeNull();
    expect(revoked!.amount).toBe(-earned.amount);
    const sum = await db.xpLedger.aggregate({ where: { userId: submitter.id }, _sum: { amount: true } });
    expect(submitter.totalXp, "users.total_xp phải bằng tổng xp_ledger").toBe(sum._sum.amount ?? 0);

    // Người duyệt Đạt: −15 uy tín (approved_fraud) từ app_config.reputation_deltas
    const deltas = (await db.appConfig.findUniqueOrThrow({ where: { key: "reputation_deltas" } })).value as { approved_fraud: number };
    for (const h of reviewers) {
      const u = await db.user.findUniqueOrThrow({ where: { handle: h }, select: { id: true, reputation: true } });
      const ev = await db.reputationEvent.findFirst({ where: { userId: u.id, reason: "approved_fraud" }, orderBy: { createdAt: "desc" } });
      expect(ev, `Thiếu reputation_events approved_fraud cho ${h}`).not.toBeNull();
      const expected = Math.max(0, repBefore.get(h)! + deltas.approved_fraud) - repBefore.get(h)!;
      expect(ev!.delta).toBe(expected);
      expect(u.reputation).toBe(repBefore.get(h)! + expected);
    }

    // Không xóa bản ghi nào; chỉ thêm
    const after = await recordCounts();
    for (const k of Object.keys(before) as (keyof typeof before)[]) {
      expect(after[k], `Số dòng ${k} giảm sau thu hồi`).toBeGreaterThanOrEqual(before[k]);
    }
    expect(after.xpLedger).toBeGreaterThan(before.xpLedger);
    expect(after.reputationEvents).toBeGreaterThanOrEqual(before.reputationEvents + reviewers.length);
    // Bài level_up bị ẩn (deleted_at), không xóa
    const post = await db.post.findFirst({ where: { proofId, kind: "level_up" }, select: { deletedAt: true } });
    expect(post?.deletedAt, "Bài level_up phải được ẩn bằng deleted_at").not.toBeNull();
  });

  test("xác nhận lần nữa không hạ level thêm (idempotent)", async ({ request }) => {
    test.skip(!reportId, "Chưa có báo cáo");
    const db = e2eDb();
    const ledgerBefore = await db.xpLedger.count({ where: { refId: proofId, reason: "revoked" } });
    const token = await devToken(request, "bientap");
    await trpcMutation(request, token, "admin.resolveReport", { reportId, decision: "confirmed" });
    expect(await userSkillLevel(SUBMITTER, SKILL)).toBe(3);
    expect(await db.xpLedger.count({ where: { refId: proofId, reason: "revoked" } })).toBe(ledgerBefore);
  });

  test("UI: biên tập viên vào được /admin, người thường thì không", async ({ page, browser }) => {
    const ctx = await browser.newContext();
    const editor = await ctx.newPage();
    try {
      await loginAs(editor, "bientap");
      const r = await editor.goto("/admin");
      test.skip(r?.status() === 404, "Màn /admin (U3.5) chưa có — chờ ui");
      expect(r?.status()).toBeLessThan(400);
      await expect(editor.getByRole("heading", { level: 1 })).toBeVisible();
    } finally {
      await ctx.close();
    }
    await loginAs(page, "minhhoang");
    const res = await page.goto("/admin");
    expect((res?.status() ?? 0) >= 400 || !/\/admin/.test(new URL(page.url()).pathname), "Người thường vào được /admin").toBeTruthy();
  });
});
