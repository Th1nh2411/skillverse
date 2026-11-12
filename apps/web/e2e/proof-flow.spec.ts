import { expect, test } from "@playwright/test";
import { expectBasicA11y } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { assignedReviewerHandles, assignmentIdFor, closeE2eDb, proofRow, userSkillLevel } from "./helpers/db";
import { gotoScreen } from "./helpers/nav";
import { reviewViaUi, submitProofViaUi, uniqueVideo } from "./helpers/proof";

/**
 * Q2.1 — Vòng lặp xác thực (quan trọng nhất):
 * minhhoang (Thắt nút dây cấp 3, kỹ năng không rủi ro, không có kỹ năng cha) nộp bằng chứng cấp 4
 * → các người được phân công (tra trong DB e2e) đăng nhập dev, chấm Đạt từng tiêu chí
 * → finalizeProof chốt: người nộp thấy Lên cấp, user_skills.level = 4.
 * Chạy tuần tự trong một describe (serial) vì các bước phụ thuộc nhau.
 */
test.describe.serial("Nộp bằng chứng → 3 người duyệt Đạt → Lên cấp", () => {
  const SUBMITTER = { handle: "minhhoang" as const, displayName: "Minh Hoàng" };
  const SKILL = { slug: "that-nut-day", name: "Thắt nút dây" };
  let proofId = "";

  test.afterAll(async () => {
    await closeE2eDb();
  });

  test("nộp bằng chứng cấp 4", async ({ page }, testInfo) => {
    expect(await userSkillLevel(SUBMITTER.handle, SKILL.slug)).toBe(3);
    proofId = await submitProofViaUi(page, { handle: SUBMITTER.handle, skillSlug: SKILL.slug, skillName: SKILL.name, file: uniqueVideo(testInfo) });

    const row = await proofRow(proofId);
    expect(row?.targetLevel).toBe(4);
    expect(row?.status).toMatch(/pending|in_review/);
    // Video lưu bằng key ngẫu nhiên, không chứa dữ liệu cá nhân
    expect(row?.mediaUrl ?? "").not.toMatch(/minhhoang|@|Minh/i);
    // Chưa duyệt thì level chưa đổi
    expect(await userSkillLevel(SUBMITTER.handle, SKILL.slug)).toBe(3);
  });

  test("trạng thái bằng chứng của tôi: tiến độ 0/3, video là URL ký có hạn", async ({ page }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    await loginAs(page, SUBMITTER.handle);
    await gotoScreen(page, `/proofs/${proofId}`, "Trạng thái bằng chứng");
    await expect(page.getByText(/0\s*\/\s*3 người đã duyệt/).first()).toBeVisible();
    const src = await page.locator("video").first().getAttribute("src").catch(() => null);
    const source = src ?? (await page.locator("video source").first().getAttribute("src").catch(() => null));
    if (source) {
      expect(source, "URL video phải là presigned GET có hạn").toMatch(/X-Amz-Expires=\d+/);
      expect(source).toMatch(/X-Amz-Signature=/);
      // Bỏ chữ ký → bucket private phải từ chối
      const bare = source.split("?")[0]!;
      const res = await page.request.get(bare, { failOnStatusCode: false });
      expect(res.status(), "Bucket không được public").toBeGreaterThanOrEqual(400);
    }
    await expectBasicA11y(page, "Trạng thái bằng chứng");
  });

  test("hàng đợi duyệt của người được phân công có bằng chứng", async ({ page }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    const reviewers = await assignedReviewerHandles(proofId);
    expect(reviewers.length, "Phải phân công 3 người duyệt").toBe(3);
    expect(reviewers).not.toContain(SUBMITTER.handle);
    await loginAs(page, reviewers[0] as never);
    await gotoScreen(page, "/review", "Hàng đợi duyệt");
    await expect(page.getByRole("link", { name: new RegExp(SKILL.name) }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(SUBMITTER.displayName);
    await expectBasicA11y(page, "Hàng đợi duyệt");
  });

  test("3 người duyệt chấm Đạt", async ({ browser }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    const reviewers = await assignedReviewerHandles(proofId);
    expect(reviewers.length).toBe(3);
    for (const [i, reviewer] of reviewers.entries()) {
      const assignmentId = await assignmentIdFor(proofId, reviewer);
      await reviewViaUi(browser, { reviewer, assignmentId: assignmentId!, verdict: "pass", submitter: SUBMITTER });
      if (i < reviewers.length - 1) {
        // Chưa đủ phiếu: level KHÔNG được đổi
        expect(await userSkillLevel(SUBMITTER.handle, SKILL.slug)).toBe(3);
      }
    }
    await expect.poll(async () => (await proofRow(proofId))?.status, { timeout: 15_000 }).toBe("passed");
    await expect.poll(() => userSkillLevel(SUBMITTER.handle, SKILL.slug)).toBe(4);
  });

  test("người nộp thấy Lên cấp", async ({ page }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    await loginAs(page, SUBMITTER.handle);
    await gotoScreen(page, `/level-up/${proofId}`, "Xong mốc");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Xong mốc /);
    await expect(page.getByText(new RegExp(SKILL.name)).first()).toBeVisible();
    await expect(page.getByText(/\+\s*\d+\s*XP/).first()).toBeVisible();
    const share = page.getByRole("button", { name: /^Chia sẻ thành tích$/ });
    await expect(share).toBeVisible();
    // Không có Web Share API trong Chromium headless → fallback sao chép link
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await share.click();
    await expect(page.getByText(/Đã sao chép link/).first()).toBeVisible();
    await expectBasicA11y(page, "Lên cấp");
  });

  test("trang chia sẻ công khai không cần đăng nhập, không lộ dữ liệu cá nhân", async ({ browser }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await gotoScreen(page, `/share/${proofId}`, "Chia sẻ");
      await expect(page).not.toHaveURL(/\/login/);
      const html = await page.content();
      expect(html).not.toMatch(/@demo\.skillverse\.local|"email"|homeCell/);
      const og = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(og, "Thiếu ảnh OG").toMatch(/\/og\/level-up\//);
      const img = await page.request.get(og!, { failOnStatusCode: false });
      expect(img.status()).toBe(200);
      expect(img.headers()["content-type"]).toMatch(/image\/png/);
    } finally {
      await ctx.close();
    }
  });
});
