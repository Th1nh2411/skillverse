import { expect, test } from "@playwright/test";
import { expectBasicA11y } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { gotoScreen } from "./helpers/nav";
import { clickable } from "./helpers/ui";

/**
 * Onboarding (Onboarding.html): người mới chọn ≥ 3 kỹ năng → (tự đánh giá, chỉ là gợi ý) → thử thách đầu tiên → hồ sơ.
 * Test này đổi dữ liệu của "nguoimoi" (onboarded_at) nên chỉ chạy được một lần sau mỗi lần seed.
 */
test.describe("Onboarding người mới", () => {
  const PICKS = ["Thắt nút dây", "Tung hứng", "Sơ cứu"];

  test("chọn 3 kỹ năng rồi vào hồ sơ", async ({ page }) => {
    await loginAs(page, "nguoimoi");
    await gotoScreen(page, "/onboarding", "Onboarding");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/giỏi điều gì/i);
    await expectBasicA11y(page, "Onboarding - chọn kỹ năng");

    const next = page.getByRole("button", { name: /^(Tiếp tục|Đã chọn \d+\/\d+|Xong|Hoàn tất|Bắt đầu thôi)$/ });

    // Chọn 2 kỹ năng: chưa đủ, chưa được đi tiếp (quy tắc ≥ 3)
    for (const name of PICKS.slice(0, 2)) await clickable(page, name).first().click();
    await expect(next.first(), "Phải chặn khi mới chọn 2 kỹ năng (cần ≥ 3)").toBeDisabled();

    await clickable(page, PICKS[2]!).first().click();
    for (const name of PICKS) {
      const chip = clickable(page, name).first();
      // Trạng thái đã chọn phải đọc được bằng trình đọc màn hình
      const selected = await chip.evaluate(
        (el) =>
          el.getAttribute("aria-pressed") ??
          el.getAttribute("aria-checked") ??
          el.getAttribute("aria-selected") ??
          (el instanceof HTMLInputElement ? String(el.checked) : null),
      );
      expect(selected, `Chip "${name}" thiếu trạng thái chọn (aria-pressed/aria-checked)`).toBe("true");
    }

    // Đi qua các bước (tự đánh giá, thử thách đầu tiên) tới khi rời /onboarding
    for (let step = 0; step < 6 && /\/onboarding/.test(page.url()); step++) {
      const selfLevel = page.getByRole("radio", { name: /Mới bắt đầu/ }).or(page.getByRole("button", { name: /^Mới bắt đầu$/ }));
      if (await selfLevel.first().isVisible().catch(() => false)) await selfLevel.first().click();
      await expect(next.first()).toBeEnabled();
      await Promise.all([page.waitForLoadState("domcontentloaded"), next.first().click()]);
      await page.waitForTimeout(300);
    }

    await expect(page, "Xong onboarding phải tới hồ sơ").toHaveURL(/\/profile/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Người Mới");

    // Đã onboarding: quay lại /onboarding phải bị chuyển đi
    await page.goto("/onboarding");
    await expect(page).not.toHaveURL(/\/onboarding/);
  });
});
