import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { loginAs, type SeedHandle } from "./auth";
import { latestProofId } from "./db";
import { gotoScreen } from "./nav";
import { clickable } from "./ui";

const SAMPLE = path.resolve(import.meta.dirname, "../fixtures/proof-sample.webm");

/**
 * Bản sao video mẫu với vài byte ngẫu nhiên ở cuối (trình phát WebM bỏ qua phần thừa) → hash SHA-256 khác nhau,
 * tránh bị chặn "trùng hash" (fraud_signals duplicate_hash) khi nhiều test nộp bằng chứng trong một lượt chạy.
 */
export function uniqueVideo(testInfo: TestInfo): string {
  const out = testInfo.outputPath(`proof-${crypto.randomUUID()}.webm`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.concat([fs.readFileSync(SAMPLE), crypto.randomBytes(32)]));
  return out;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Nộp bằng chứng qua giao diện /proof/new (Proof.html): chọn file video, (cam kết an toàn nếu có), "Gửi xác thực".
 * Trả về proofId (lấy từ URL /proofs/<id>, hoặc từ DB nếu UI không chuyển trang).
 */
export async function submitProofViaUi(page: Page, opts: { handle: SeedHandle; skillSlug: string; skillName: string; file: string }) {
  await loginAs(page, opts.handle);
  await gotoScreen(page, `/proof/new?skill=${opts.skillSlug}`, "Đăng bằng chứng");
  const fileInput = page.locator('input[type="file"]');
  test.skip((await fileInput.count()) === 0, "Màn Đăng bằng chứng chưa có ô chọn file (U2.1) — chờ ui");

  // Kỹ năng có thể đã chọn sẵn từ ?skill=; nếu chưa, chọn theo tên
  const skillPick = clickable(page, new RegExp(opts.skillName)).first();
  if ((await skillPick.count()) > 0 && (await skillPick.getAttribute("aria-pressed")) === "false") await skillPick.click();

  await fileInput.first().setInputFiles(opts.file);
  const safety = page.getByRole("checkbox", { name: /an toàn/i });
  if ((await safety.count()) > 0) await safety.first().check();
  const caption = page.getByRole("textbox", { name: /^Mô tả/ });
  if ((await caption.count()) > 0) await caption.first().fill("Bằng chứng e2e");

  const send = page.getByRole("button", { name: /^Gửi xác thực$/ });
  await expect(send, "Nút Gửi xác thực phải bật sau khi upload xong").toBeEnabled({ timeout: 60_000 });
  await send.click();
  // Thành công: chuyển sang /proofs/<id> (trang trạng thái) hoặc báo "Đã gửi xác thực" tại chỗ
  await expect
    .poll(async () => !/\/proof\/new/.test(page.url()) || (await page.getByText(/Đã gửi xác thực/).count()) > 0, { timeout: 30_000 })
    .toBe(true);

  const fromUrl = page.url().match(UUID)?.[0];
  const proofId = fromUrl ?? (await latestProofId(opts.handle, opts.skillSlug));
  expect(proofId, "Không tìm thấy bằng chứng vừa nộp").toBeTruthy();
  return proofId!;
}

/**
 * Một người duyệt chấm toàn bộ tiêu chí ở /review/<assignmentId> (Review.html) rồi gửi phiếu.
 * Đồng thời kiểm tra ẩn danh: trang duyệt không được chứa tên hiển thị / handle người nộp.
 */
export async function reviewViaUi(
  browser: Browser,
  opts: { reviewer: string; assignmentId: string; verdict: "pass" | "fail"; submitter: { handle: string; displayName: string } },
) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await loginAs(page, opts.reviewer as SeedHandle);
    await gotoScreen(page, `/review/${opts.assignmentId}`, "Duyệt");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const body = await page.locator("body").innerText();
    expect(body, "Trang duyệt lộ tên người nộp").not.toContain(opts.submitter.displayName);
    expect(body, "Trang duyệt lộ handle người nộp").not.toContain(`@${opts.submitter.handle}`);
    expect(await page.content(), "HTML trang duyệt lộ handle người nộp").not.toContain(`"${opts.submitter.handle}"`);

    const mark = opts.verdict === "pass" ? /^Đạt$/ : /^Chưa đạt$/;
    const marks = page.getByRole("radio", { name: mark }).or(page.getByRole("button", { name: mark }));
    const n = await marks.count();
    expect(n, "Không có nút chấm Đạt/Chưa đạt theo tiêu chí").toBeGreaterThan(0);
    // Trước khi chấm đủ, nút gửi bị khóa ("Chấm k/n tiêu chí")
    await expect(page.getByRole("button", { name: /^Chấm \d+\/\d+ tiêu chí$/ })).toBeDisabled();
    for (let i = 0; i < n; i++) {
      await marks.nth(i).click();
      await expect(marks.nth(i)).toHaveAttribute("aria-pressed", "true");
    }

    const comment = page.getByRole("textbox", { name: /nhận xét/i });
    if ((await comment.count()) > 0) await comment.first().fill(opts.verdict === "pass" ? "Rõ ràng, đạt tiêu chí." : "Chưa đạt thời gian yêu cầu.");

    const send = opts.verdict === "pass" ? /^Xác nhận đạt cấp \d+$/ : /^Gửi phiếu chưa đạt$/;
    await page.getByRole("button", { name: send }).click();
    await expect(page.getByText(/Đã gửi phiếu/).first()).toBeVisible({ timeout: 30_000 });
  } finally {
    await ctx.close();
  }
}
