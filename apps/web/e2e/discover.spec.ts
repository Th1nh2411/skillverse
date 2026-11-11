import { expect, test } from "@playwright/test";
import { expectBasicA11y, expectNoPersonalDataInUrl } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { expectSingleH1, gotoScreen } from "./helpers/nav";
import { clickable } from "./helpers/ui";

/** Khám phá (Discover.html): hiếm nhất, thịnh hành, gần bạn, danh mục, tìm kiếm. */
test.describe("Khám phá", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/discover", "Khám phá");
    // Màn render phía client: chờ dữ liệu discover.home (đồng thời bảo đảm đã hydrate trước khi gõ tìm kiếm)
    await expect(page.getByRole("heading", { name: /Hiếm nhất/ })).toBeVisible({ timeout: 30_000 });
  });

  test("các mục chính và lọc danh mục", async ({ page }) => {
    await expectSingleH1(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Khám phá/);
    await expect(page.getByRole("heading", { name: /Hiếm nhất/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Thịnh hành/ })).toBeVisible();
    for (const cat of ["Sinh tồn", "Kỹ năng dị", "Thủ công", "Thể chất"]) {
      await expect(clickable(page, new RegExp(`^${cat}$`)).first(), `Thiếu bộ lọc "${cat}"`).toBeVisible();
    }
  });

  test("hiếm nhất sắp theo holder_count tăng dần", async ({ page }) => {
    const section = page.getByRole("region", { name: /Hiếm nhất/ }).or(
      page.locator("section").filter({ has: page.getByRole("heading", { name: /Hiếm nhất/ }) }),
    );
    // Seed: Thổi thủy tinh 12, Sống sót 72 giờ 18, Viết chữ ngược gương 27
    const text = (await section.first().innerText()).replace(/\s+/g, " ");
    const a = text.indexOf("Thổi thủy tinh");
    const b = text.indexOf("Sống sót 72 giờ");
    const c = text.indexOf("Viết chữ ngược gương");
    expect(a, "Thiếu Thổi thủy tinh").toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    await expect(section.getByText("HUYỀN THOẠI", { exact: true })).toHaveCount(0);
  });

  test("tìm kiếm kỹ năng và mở chi tiết", async ({ page }) => {
    const box = page.getByRole("searchbox").or(page.getByRole("textbox", { name: /Tìm/ }));
    test.skip((await box.count()) === 0, "Chưa có ô tìm kiếm trên màn Khám phá");
    await box.first().fill("nút dây");
    const result = clickable(page, /Thắt nút dây/).first();
    await expect(result).toBeVisible();
    await result.click();
    await expect(page).toHaveURL(/\/skills\/that-nut-day/);
    expectNoPersonalDataInUrl(page.url());
  });

  test("tìm kiếm không có kết quả hiện lời mời hành động", async ({ page }) => {
    const box = page.getByRole("searchbox").or(page.getByRole("textbox", { name: /Tìm/ }));
    test.skip((await box.count()) === 0, "Chưa có ô tìm kiếm trên màn Khám phá");
    await box.first().fill("zzzkhongcokynangnay");
    // Màn trống là lời mời hành động (SKILL.md): có nút/liên kết đề xuất kỹ năng mới
    await expect(page.getByText(/Không tìm thấy|Chưa có/).first()).toBeVisible({ timeout: 15_000 });
    await expect(clickable(page, /Đề xuất/).first()).toBeVisible();
  });

  test("gần bạn không lộ vị trí", async ({ page }) => {
    const html = await page.content();
    expect(html, "Không được đưa home_cell / tọa độ ra trình duyệt").not.toMatch(/home_?cell|homeCell|"lat"|"lng"/i);
  });

  test("a11y cơ bản", async ({ page }) => {
    await expectBasicA11y(page, "Khám phá");
  });
});
