import { expect, test } from "@playwright/test";
import { E2E_CRON_SECRET } from "./env";
import { loginAs } from "./helpers/auth";
import { closeE2eDb, e2eDb } from "./helpers/db";
import { expireVoting, setConfig } from "./helpers/fixtures";
import { gotoScreen } from "./helpers/nav";
import { uniqueVideo } from "./helpers/proof";
import { devToken, skipIfNoProcedure, trpcMutation, trpcQuery } from "./helpers/trpc";
import { submitProofViaApi } from "./helpers/verification";

/**
 * Giai đoạn 4 — Cộng đồng góp ý.
 * Q4.1 đề xuất kỹ năng mới → ủng hộ (hạ new_skill_support_needed.supporters = 3 trong DB e2e) → biên tập viên duyệt → có ở Khám phá.
 * Q4.2 sửa tiêu chí "Thắt nút dây" cấp 3 → bỏ phiếu có trọng số (voter_min_level = 5) → hết hạn → /api/cron đóng
 *      → criteria_versions mới, current_version_id trỏ bản mới, bản cũ giữ nguyên, bằng chứng cũ giữ phiên bản cũ.
 */
test.afterAll(async () => {
  await closeE2eDb();
});

test.describe.serial("Đề xuất kỹ năng mới (Q4.1)", () => {
  const NAME = "Gấp giấy origami";
  let proposalId = "";
  let restore: (() => Promise<void>) | null = null;

  test.afterAll(async () => {
    await restore?.();
  });

  test("validate: dưới 3 cấp bị chặn; chưa đăng nhập bị chặn", async ({ request }) => {
    const anon = await trpcMutation(request, null, "proposal.createNewSkill", { name: NAME, categorySlug: "thu-cong", levels: [] });
    skipIfNoProcedure(anon, "proposal.createNewSkill");
    expect(anon.status).toBe(401);
    const token = await devToken(request, "minhhoang");
    const r = await trpcMutation(request, token, "proposal.createNewSkill", {
      name: NAME,
      categorySlug: "thu-cong",
      levels: [[{ text: "Gấp được hạc giấy" }], [{ text: "Gấp được hoa sen" }]],
    });
    expect(r.status).toBe(400);
  });

  test("tạo đề xuất → đủ người ủng hộ → chờ biên tập", async ({ request }) => {
    restore = await setConfig("new_skill_support_needed", { supporters: 3 });
    const author = await devToken(request, "minhhoang");
    const levels = ["Gấp hạc giấy trong 3 phút", "Gấp hoa sen 8 cánh", "Gấp rồng từ một tờ giấy"].map((t) => [{ text: t }]);
    const r = await trpcMutation(request, author, "proposal.createNewSkill", {
      name: NAME,
      categorySlug: "thu-cong",
      description: "Gấp hình từ một tờ giấy, không cắt dán.",
      levels,
    });
    skipIfNoProcedure(r, "proposal.createNewSkill");
    expect(r.status, r.raw.slice(0, 300)).toBe(200);
    proposalId = (r.data as { proposalId: string }).proposalId;

    const dup = await trpcMutation(request, author, "proposal.createNewSkill", { name: NAME, categorySlug: "thu-cong", levels });
    expect(dup.status, "Trùng tên phải bị chặn").toBe(409);

    for (const h of ["quocbao", "thuha"]) {
      const s = await trpcMutation(request, await devToken(request, h), "proposal.support", { proposalId });
      expect(s.status, s.raw.slice(0, 200)).toBe(200);
    }
    const pr = await e2eDb().proposal.findUniqueOrThrow({ where: { id: proposalId }, select: { status: true, supportCount: true } });
    expect(pr.supportCount).toBeGreaterThanOrEqual(3);
    expect(pr.status).toBe("editor_review");
    // Chưa duyệt thì chưa có kỹ năng
    expect(await e2eDb().skill.count({ where: { name: NAME } })).toBe(0);
  });

  test("người thường không duyệt được; biên tập viên duyệt → kỹ năng mở", async ({ request }) => {
    test.skip(!proposalId, "Chưa có đề xuất");
    const user = await devToken(request, "minhhoang");
    expect((await trpcQuery(request, user, "admin.proposals")).status).toBe(403);
    expect((await trpcMutation(request, user, "admin.decideProposal", { proposalId, decision: "accepted" })).status).toBe(403);

    const editor = await devToken(request, "bientap");
    const q = await trpcQuery(request, editor, "admin.proposals");
    expect(q.status).toBe(200);
    expect(q.raw).toContain(proposalId);
    const d = await trpcMutation(request, editor, "admin.decideProposal", { proposalId, decision: "accepted" });
    expect(d.status, d.raw.slice(0, 300)).toBe(200);

    const db = e2eDb();
    const skill = await db.skill.findFirstOrThrow({
      where: { name: NAME },
      select: { id: true, status: true, skillLevels: { select: { level: true, currentVersionId: true }, orderBy: { level: "asc" } } },
    });
    expect(skill.status).toBe("active");
    expect(skill.skillLevels.map((l) => l.level)).toEqual([1, 2, 3]);
    for (const l of skill.skillLevels) expect(l.currentVersionId, `Cấp ${l.level} thiếu criteria_versions v1`).not.toBeNull();
    const author = await db.user.findUniqueOrThrow({ where: { handle: "minhhoang" }, select: { id: true } });
    expect(await db.xpLedger.count({ where: { userId: author.id, reason: "proposal_accepted", refId: proposalId } })).toBe(1);
    expect((await db.proposal.findUniqueOrThrow({ where: { id: proposalId } })).status).toBe("accepted");

    const search = await trpcQuery(request, user, "skill.search", { query: "origami", limit: 5 });
    expect(search.raw).toContain(NAME);
  });

  test("UI: kỹ năng mới xuất hiện ở Khám phá", async ({ page }) => {
    test.skip(!proposalId, "Chưa có đề xuất");
    await loginAs(page, "lanphuong");
    await gotoScreen(page, "/discover", "Khám phá");
    await expect(page.getByRole("heading", { name: /Hiếm nhất/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("searchbox").first().fill("origami");
    const hit = page.getByRole("link", { name: new RegExp(NAME) }).first();
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(NAME));
  });
});

test.describe.serial("Bỏ phiếu sửa tiêu chí → đóng qua cron (Q4.2)", () => {
  const SKILL = "that-nut-day";
  const LEVEL = 3;
  const NEW_TEXT = "Thắt Bowline bằng một tay trong 15 giây";
  let proposalId = "";
  let skillLevelId = "";
  let oldVersionId = "";
  let oldTexts: string[] = [];
  let oldProofId = "";
  const restores: (() => Promise<void>)[] = [];

  test.afterAll(async () => {
    for (const r of restores) await r();
  });

  test("bằng chứng nộp trước khi sửa tiêu chí giữ phiên bản cũ (chuẩn bị)", async ({ request }, testInfo) => {
    const db = e2eDb();
    const sl = await db.skillLevel.findFirstOrThrow({
      where: { level: LEVEL, skill: { slug: SKILL } },
      select: { id: true, currentVersionId: true, currentVersion: { select: { criteria: { select: { text: true }, orderBy: { position: "asc" } } } } },
    });
    skillLevelId = sl.id;
    oldVersionId = sl.currentVersionId!;
    oldTexts = sl.currentVersion!.criteria.map((c) => c.text);
    // tuankiet: Thắt nút dây cấp 2 → nộp cấp 3 (đang chờ duyệt, gắn criteria_version hiện tại)
    oldProofId = await submitProofViaApi(request, { handle: "tuankiet", skillSlug: SKILL, targetLevel: LEVEL, file: uniqueVideo(testInfo) });
    expect((await db.proof.findUniqueOrThrow({ where: { id: oldProofId } })).criteriaVersionId).toBe(oldVersionId);
  });

  test("tạo đề xuất và bỏ phiếu có trọng số", async ({ request }) => {
    restores.push(await setConfig("criteria_change_rule", { min_votes: 2 }));
    const author = await devToken(request, "quocbao");
    const r = await trpcMutation(request, author, "proposal.createCriteriaEdit", {
      skillLevelId,
      criteria: [{ text: NEW_TEXT }, { text: "Nút chịu lực khi kéo căng" }],
      summary: "Rút thời gian, thêm kiểm tra chịu lực",
    });
    skipIfNoProcedure(r, "proposal.createCriteriaEdit");
    expect(r.status, r.raw.slice(0, 300)).toBe(200);
    proposalId = (r.data as { proposalId: string }).proposalId;

    const vote = async (h: string, v: "agree" | "disagree") => {
      const res = await trpcMutation(request, await devToken(request, h), "proposal.vote", { proposalId, vote: v });
      expect(res.status, `${h}: ${res.raw.slice(0, 200)}`).toBe(200);
    };
    await vote("quocbao", "agree"); // cấp 5 → weight 1
    await vote("bientap", "agree"); // cấp 5 → weight 1
    await vote("hoangnam", "disagree"); // cấp 3 → weight 0
    // Đổi phiếu trước hạn: vẫn 1 phiếu/người
    await vote("hoangnam", "agree");
    await vote("hoangnam", "disagree");

    const db = e2eDb();
    const votes = await db.proposalVote.findMany({ where: { proposalId }, select: { weight: true, vote: true, user: { select: { handle: true } } } });
    const byHandle = new Map(votes.map((v) => [v.user.handle, v]));
    expect(votes.filter((v) => v.user.handle === "hoangnam")).toHaveLength(1);
    expect(byHandle.get("hoangnam")?.weight, "Người chưa đạt voter_min_level phải có weight 0").toBe(0);
    expect(byHandle.get("quocbao")?.weight).toBe(1);
    expect(byHandle.get("bientap")?.weight).toBe(1);
    // Chưa hết hạn: chưa có phiên bản mới
    expect((await db.skillLevel.findUniqueOrThrow({ where: { id: skillLevelId } })).currentVersionId).toBe(oldVersionId);
  });

  test("hết hạn → /api/cron đóng → phiên bản tiêu chí mới, bản cũ nguyên vẹn", async ({ request }) => {
    test.skip(!proposalId, "Chưa có đề xuất");
    await expireVoting(proposalId);
    const res = await request.post("/api/cron", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { jobs: { closeExpiredProposals?: { ok: boolean; result?: { criteriaAccepted?: number } } } };
    expect(body.jobs.closeExpiredProposals?.ok).toBe(true);
    expect(body.jobs.closeExpiredProposals?.result?.criteriaAccepted ?? 0).toBeGreaterThanOrEqual(1);

    const db = e2eDb();
    expect((await db.proposal.findUniqueOrThrow({ where: { id: proposalId } })).status).toBe("accepted");
    const sl = await db.skillLevel.findUniqueOrThrow({ where: { id: skillLevelId }, select: { currentVersionId: true } });
    expect(sl.currentVersionId).not.toBe(oldVersionId);
    const [oldV, newV] = await Promise.all([
      db.criteriaVersion.findUniqueOrThrow({ where: { id: oldVersionId }, select: { version: true, criteria: { select: { text: true }, orderBy: { position: "asc" } } } }),
      db.criteriaVersion.findUniqueOrThrow({ where: { id: sl.currentVersionId! }, select: { version: true, sourceProposalId: true, criteria: { select: { text: true }, orderBy: { position: "asc" } } } }),
    ]);
    expect(newV.version).toBe(oldV.version + 1);
    expect(newV.sourceProposalId).toBe(proposalId);
    expect(newV.criteria.map((c) => c.text)).toContain(NEW_TEXT);
    // KHÔNG UPDATE criteria: bản cũ giữ nguyên văn
    expect(oldV.criteria.map((c) => c.text)).toEqual(oldTexts);
    // Bằng chứng cũ giữ phiên bản cũ
    expect((await db.proof.findUniqueOrThrow({ where: { id: oldProofId } })).criteriaVersionId).toBe(oldVersionId);
    const author = await db.user.findUniqueOrThrow({ where: { handle: "quocbao" }, select: { id: true } });
    expect(await db.xpLedger.count({ where: { userId: author.id, reason: "proposal_accepted", refId: proposalId } })).toBe(1);

    // Cron chạy lại: không đóng lần hai
    await request.post("/api/cron", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
    expect(await db.criteriaVersion.count({ where: { sourceProposalId: proposalId } })).toBe(1);
  });

  test("UI: chi tiết kỹ năng hiện tiêu chí phiên bản mới; người duyệt bằng chứng cũ thấy tiêu chí cũ", async ({ page, browser }) => {
    test.skip(!proposalId, "Chưa có đề xuất");
    await loginAs(page, "tuankiet");
    await gotoScreen(page, `/skills/${SKILL}`, "Chi tiết kỹ năng");
    await expect(page.getByText(NEW_TEXT).first()).toBeVisible();

    const a = await e2eDb().reviewAssignment.findFirst({
      where: { proofId: oldProofId, state: "assigned" },
      select: { id: true, reviewer: { select: { handle: true } } },
    });
    test.skip(!a, "Bằng chứng cũ chưa có người được phân công");
    const ctx = await browser.newContext();
    const rp = await ctx.newPage();
    try {
      await loginAs(rp, a!.reviewer.handle as never);
      await gotoScreen(rp, `/review/${a!.id}`, "Duyệt");
      await expect(rp.getByText(oldTexts[0]!).first()).toBeVisible();
      await expect(rp.getByText(NEW_TEXT)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});
