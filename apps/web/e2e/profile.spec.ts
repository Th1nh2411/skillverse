import { expect, test } from "@playwright/test";
import { expectBasicA11y, expectNoPersonalDataInUrl } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { expectSingleH1, gotoScreen } from "./helpers/nav";
import { clickable } from "./helpers/ui";

/** Hồ sơ của tôi (Main.html) — dữ liệu seed của minhhoang. */
test.describe("Hồ sơ", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/profile", "Hồ sơ");
  });

  test("hiển thị tên, handle, cấp và thống kê", async ({ page }) => {
    await expectSingleH1(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Minh Hoàng/);
    await expect(page.getByText("@minhhoang")).toBeVisible();
    // Thống kê: số kỹ năng (seed: 8), huy hiệu hiếm, thử thách
    await expect(page.getByText(/^Kỹ năng$/).first()).toBeVisible();
    await expect(page.getByText(/Huy hiệu hiếm/)).toBeVisible();
    await expect(page.getByText(/^Thử thách$/).first()).toBeVisible();
    // Tiến độ XP dạng phân số / thanh tiến độ, không viết câu
    await expect(page.getByRole("progressbar").first()).toBeVisible();
    // Không email trên màn hình hồ sơ
    await expect(page.getByText(/@demo\.skillverse\.local/)).toHaveCount(0);
    expectNoPersonalDataInUrl(page.url());
  });

  test("kỹ năng nổi bật có độ hiếm và trạng thái", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^Kỹ năng$/ })).toBeVisible();
    // Mở khóa thể thao: holder_count 38 < 50 → Huyền thoại (độ hiếm thể hiện bằng huy hiệu, có tên truy cập được)
    await expect(page.getByText("Mở khóa thể thao").first()).toBeVisible();
    await expect(page.getByLabel(/Huyền thoại/).or(page.getByText(/Huyền thoại/)).first()).toBeVisible();
    // Không nhãn viết HOA kiểu mockup (SKILL.md "Những thứ cần sửa")
    await expect(page.getByText("HUYỀN THOẠI", { exact: true })).toHaveCount(0);
  });

  test("đi tới cây kỹ năng", async ({ page }) => {
    await clickable(page, /Xem cây kỹ năng|Cây kỹ năng/).first().click();
    await expect(page).toHaveURL(/\/skills\/tree\//);
  });

  test("a11y cơ bản", async ({ page }) => {
    await expectBasicA11y(page, "Hồ sơ");
  });
});
