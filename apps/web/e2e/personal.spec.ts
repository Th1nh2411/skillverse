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

  test("đánh dấu cần xác nhận, có Hoàn tác, bỏ đánh dấu cũng hỏi lại", async ({ page }) => {
    await gotoScreen(page, `/skills/${SKILL.slug}`, "Chi tiết kỹ năng");
    const nextTick = page.getByRole("button", { name: /^Đánh dấu xong mốc / }).first();
    await expect(nextTick).toBeVisible();
    const name = ((await nextTick.getAttribute("aria-label")) ?? "").replace(/^Đánh dấu xong mốc /, "");
    expect(name.length).toBeGreaterThan(0);
    const tickBtn = page.getByRole("button", { name: `Đánh dấu xong mốc ${name}` });
    const untickBtn = page.getByRole("button", { name: `Bỏ đánh dấu mốc ${name}` });

    // 1) "Xong rồi" mở sheet hỏi lại; "Chưa" thì không đổi gì
    await page.getByRole("button", { name: /^Xong rồi$/ }).first().click();
    let dialog = page.getByRole("dialog", { name: `Xong mốc ${name}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Chưa" }).click();
    await expect(dialog).toBeHidden();
    await expect(tickBtn).toBeVisible();

    // 2) Xác nhận → toast có "Hoàn tác" → bấm hoàn tác thì trở lại chưa xong (lưu ở máy chủ)
    await tickBtn.click();
    dialog = page.getByRole("dialog", { name: `Xong mốc ${name}?` });
    await dialog.getByRole("button", { name: /^Xong rồi$/ }).click();
    await expect(untickBtn).toBeVisible();
    await expect(page.getByText(`Xong mốc ${name}!`).first()).toBeVisible();
    await page.getByRole("button", { name: "Hoàn tác" }).click();
    await expect(page.getByText("Đã hoàn tác").first()).toBeVisible();
    await expect(tickBtn).toBeVisible();
    await page.reload();
    await expect(tickBtn).toBeVisible();

    // 3) Đánh dấu lại, tải lại vẫn còn, nhãn "Tự đánh dấu"
    await tickBtn.click();
    await page.getByRole("dialog", { name: `Xong mốc ${name}?` }).getByRole("button", { name: /^Xong rồi$/ }).click();
    await expect(untickBtn).toBeVisible();
    // Giao diện cập nhật lạc quan: chờ máy chủ xác nhận (toast) rồi mới tải lại
    await expect(page.getByText(`Xong mốc ${name}!`).first()).toBeVisible();
    await page.reload();
    await expect(untickBtn).toBeVisible();
    await expect(page.getByText("Tự đánh dấu").first()).toBeVisible();

    // 4) Bỏ đánh dấu cũng hỏi lại
    await untickBtn.click();
    dialog = page.getByRole("dialog", { name: `Bỏ đánh dấu ${name}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Bỏ đánh dấu" }).click();
    await expect(tickBtn).toBeVisible();
    await expect(page.getByText(`Đã bỏ đánh dấu ${name}`).first()).toBeVisible();
    await page.reload();
    await expect(tickBtn).toBeVisible();
  });

  test("mốc đã xác nhận nổi bật và không bỏ được", async ({ page }) => {
    // Lửa bằng que: minhhoang đã được xác nhận 3 mốc
    await gotoScreen(page, "/skills/lua-bang-que", "Chi tiết kỹ năng");
    await expect(page.getByText(/\d+ đã xác nhận/).first()).toBeVisible();
    await expect(page.getByText("Đã xác nhận", { exact: true }).first()).toBeVisible();
    const verified = page.getByRole("button", { name: /: đã xác nhận$/ }).first();
    await verified.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Cộng đồng đã xem video/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Bỏ đánh dấu" })).toHaveCount(0);
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
