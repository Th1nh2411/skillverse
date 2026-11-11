import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  assignedReviewerHandles,
  assignmentIdFor,
  closeE2eDb,
  nonAssignedReviewerHandle,
  proofRow,
  userSkillLevel,
} from "./helpers/db";
import { gotoScreen } from "./helpers/nav";
import { reviewViaUi, submitProofViaUi, uniqueVideo } from "./helpers/proof";
import { devToken, skipIfNoProcedure, trpcMutation, trpcQuery } from "./helpers/trpc";
import { clickable } from "./helpers/ui";

/**
 * Q2.2 — maianh (Thắt nút dây cấp 3) nộp bằng chứng cấp 4:
 * - payload review.task không lộ người nộp; người không được phân công bị chặn (UI + API, không lấy được video)
 * - cả 3 chấm Chưa đạt → trượt, level giữ nguyên, thấy kết quả từng tiêu chí → Kháng nghị (một lần).
 */
test.describe.serial("Trượt, kháng nghị và quyền duyệt", () => {
  const SUBMITTER = { handle: "maianh" as const, displayName: "Mai Anh" };
  const SKILL = { slug: "that-nut-day", name: "Thắt nút dây" };
  let proofId = "";

  test.afterAll(async () => {
    await closeE2eDb();
  });

  test("nộp bằng chứng", async ({ page }, testInfo) => {
    proofId = await submitProofViaUi(page, { handle: SUBMITTER.handle, skillSlug: SKILL.slug, skillName: SKILL.name, file: uniqueVideo(testInfo) });
    expect((await assignedReviewerHandles(proofId)).length).toBe(3);
  });

  test("API review.task ẩn danh người nộp", async ({ request }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    const [reviewer] = await assignedReviewerHandles(proofId);
    const assignmentId = await assignmentIdFor(proofId, reviewer!);
    const token = await devToken(request, reviewer!);
    const r = await trpcQuery(request, token, "review.task", { assignmentId });
    skipIfNoProcedure(r, "review.task");
    expect(r.status, r.raw.slice(0, 300)).toBe(200);
    const row = await proofRow(proofId);
    expect(r.raw, "review.task lộ user id người nộp").not.toContain(row!.userId);
    expect(r.raw, "review.task lộ handle người nộp").not.toContain(SUBMITTER.handle);
    expect(r.raw, "review.task lộ tên người nộp").not.toContain(SUBMITTER.displayName);
    // URL video (nếu có) là presigned có hạn
    const urls = r.raw.match(/https?:\/\/[^"]+/g) ?? [];
    for (const u of urls.filter((x) => /\.(webm|mp4|mov)|skillverse-proofs/.test(x))) {
      expect(u).toMatch(/X-Amz-Expires=/);
    }
  });

  test("người không được phân công bị chặn (API + UI)", async ({ page, request }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    const [reviewer] = await assignedReviewerHandles(proofId);
    const assignmentId = await assignmentIdFor(proofId, reviewer!);
    const outsider = await nonAssignedReviewerHandle(proofId);

    const token = await devToken(request, outsider);
    const task = await trpcQuery(request, token, "review.task", { assignmentId });
    skipIfNoProcedure(task, "review.task");
    expect([403, 404], `review.task cho người ngoài: ${task.status}`).toContain(task.status);
    expect(task.raw).not.toMatch(/X-Amz-Signature/);

    const submit = await trpcMutation(request, token, "review.submit", { assignmentId, verdict: "pass", marks: [] });
    expect(submit.status, "review.submit của người ngoài phải bị chặn").toBeGreaterThanOrEqual(400);
    expect(submit.status).toBeLessThan(500);

    await loginAs(page, outsider as never);
    const res = await page.goto(`/review/${assignmentId}`);
    const blocked = (res?.status() ?? 0) >= 400 || !/\/review\//.test(page.url()) || (await page.getByText(/không có quyền|không tìm thấy/i).count()) > 0;
    expect(blocked, "Người ngoài vẫn mở được trang duyệt").toBeTruthy();
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("cả 3 chấm Chưa đạt → trượt, level giữ nguyên", async ({ browser }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    for (const reviewer of await assignedReviewerHandles(proofId)) {
      const assignmentId = await assignmentIdFor(proofId, reviewer);
      await reviewViaUi(browser, { reviewer, assignmentId: assignmentId!, verdict: "fail", submitter: SUBMITTER });
    }
    await expect.poll(async () => (await proofRow(proofId))?.status, { timeout: 15_000 }).toBe("failed");
    expect(await userSkillLevel(SUBMITTER.handle, SKILL.slug)).toBe(3);
  });

  test("người nộp thấy kết quả từng tiêu chí và kháng nghị một lần", async ({ page }) => {
    test.skip(!proofId, "Bước nộp chưa chạy được");
    await loginAs(page, SUBMITTER.handle);
    await gotoScreen(page, `/proofs/${proofId}`, "Trạng thái bằng chứng");
    await expect(page.getByText(/Chưa đạt/).first()).toBeVisible();
    // Kết quả theo tiêu chí, không lộ người duyệt
    await expect(page.locator("body")).not.toContainText(/quocbao|thuha|ducanh|bientap|Quốc Bảo|Thu Hà|Đức Anh/);

    await clickable(page, /^Kháng nghị$/).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").first().fill("Video đã quay đủ thời gian, nhờ xem lại tiêu chí 1.");
    await dialog.getByRole("button", { name: /^(Gửi kháng nghị|Gửi)$/ }).click();
    await expect(page.getByText(/Đã gửi kháng nghị|Đang xem xét/).first()).toBeVisible();
    await expect.poll(async () => (await proofRow(proofId))?.appeal?.status).toBe("open");

    // Một lần mỗi bằng chứng
    await page.reload();
    await expect(page.getByRole("button", { name: /^Kháng nghị$/ })).toHaveCount(0);
    // Kháng nghị không tự đổi level
    expect(await userSkillLevel(SUBMITTER.handle, SKILL.slug)).toBe(3);
  });
});
