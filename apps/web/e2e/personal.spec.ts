import { expect, test } from "@playwright/test";
import { expectBasicA11y } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { gotoScreen } from "./helpers/nav";

/**
 * D73 tự đánh dấu mốc + D74 lưu. minhhoang: Dựng trại chưa đánh dấu mốc nào (kỹ năng cha Sinh tồn cơ bản đã xong).
 * Mỗi test tự dọn (bỏ đánh dấu / bỏ lưu) để chạy lại được trên cùng DB.
 */
const SKILL = { slug: "dung-trai", name: "Dựng trại" };

test.describe.serial("Tự đánh dấu mốc và Lưu", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "minhhoang");
  });

  test("đánh dấu xong mốc kế tiếp rồi bỏ đánh dấu", async ({ page }) => {
    await gotoScreen(page, `/skills/${SKILL.slug}`, "Chi tiết kỹ năng");
    const nextTick = page.getByRole("button", { name: /^Đánh dấu xong mốc / }).first();
    await expect(nextTick).toBeVisible();
    const name = ((await nextTick.getAttribute("aria-label")) ?? "").replace(/^Đánh dấu xong mốc /, "");
    expect(name.length).toBeGreaterThan(0);

    // Hành động chính trên mốc kế tiếp: "Xong rồi" (không cần video)
    await page.getByRole("button", { name: /^Xong rồi$/ }).click();
    const undo = page.getByRole("button", { name: `Bỏ đánh dấu mốc ${name}` });
    await expect(undo).toBeVisible();
    await expect(undo).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(`Xong mốc ${name}!`).first()).toBeVisible();

    // Lưu ở máy chủ: tải lại vẫn còn
    await page.reload();
    await expect(page.getByRole("button", { name: `Bỏ đánh dấu mốc ${name}` })).toBeVisible();

    // Bỏ đánh dấu
    await page.getByRole("button", { name: `Bỏ đánh dấu mốc ${name}` }).click();
    await expect(page.getByRole("button", { name: `Đánh dấu xong mốc ${name}` })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: `Đánh dấu xong mốc ${name}` })).toBeVisible();
  });

  test("lưu kỹ năng, thấy trong Đã lưu, rồi bỏ lưu", async ({ page }) => {
    await gotoScreen(page, `/skills/${SKILL.slug}`, "Chi tiết kỹ năng");
    const save = page.getByRole("button", { name: /^(Lưu|Bỏ lưu)$/ }).first();
    if ((await save.getAttribute("aria-pressed")) === "true") {
      await save.click();
      await expect(save).toHaveAttribute("aria-pressed", "false");
    }
    await save.click();
    await expect(page.getByRole("button", { name: "Bỏ lưu" }).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/^Đã lưu$/).first()).toBeVisible();

    await gotoScreen(page, "/profile?tab=saved", "Đã lưu");
    await expect(page.getByRole("tab", { name: /Đã lưu/ })).toHaveAttribute("aria-selected", "true");
    const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(SKILL.name) }) });
    await expect(row).toBeVisible();
    await expectBasicA11y(page, "Đã lưu");

    await row.getByRole("button", { name: "Bỏ lưu" }).click();
    await expect(page.getByRole("link", { name: new RegExp(SKILL.name) })).toHaveCount(0);
  });

  test("lưu bài trên bảng tin", async ({ page }) => {
    await gotoScreen(page, "/home", "Trang chủ");
    const btn = page.getByRole("button", { name: /^(Lưu|Bỏ lưu)$/ }).first();
    await expect(btn).toBeVisible();
    const before = await btn.getAttribute("aria-pressed");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", before ?? "false");
  });
});
