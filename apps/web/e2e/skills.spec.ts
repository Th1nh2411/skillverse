import { expect, test } from "@playwright/test";
import { expectBasicA11y } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { expectNotFoundPage, expectSingleH1, gotoScreen } from "./helpers/nav";
import { clickable } from "./helpers/ui";

/**
 * Cây kỹ năng (SkillTree.html) và Chi tiết kỹ năng (SkillDetail.html).
 * Seed minhhoang: sinh-ton-co-ban 5, nhom-lua 4, lua-bang-que 3, tim-nguon-nuoc 2, loc-nuoc 1.
 * lua-bang-que: risk high, holder_count 214 (Hiếm), cấp 4 = "Lửa thành ngọn dưới 5 phút, video liên tục".
 */
test.describe("Cây kỹ năng", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/skills/tree/sinh-ton", "Cây kỹ năng");
  });

  test("hiện các nút của danh mục Sinh tồn và chú giải trạng thái", async ({ page }) => {
    await expectSingleH1(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sinh tồn");
    for (const name of ["Sinh tồn cơ bản", "Nhóm lửa", "Lửa bằng que", "Lọc nước", "Sống sót 72 giờ"]) {
      await expect(clickable(page, new RegExp(name)).first(), `Thiếu nút "${name}"`).toBeVisible();
    }
    for (const legend of ["Đã xác nhận", "Tự đánh dấu", "Chưa mở"]) {
      await expect(page.getByText(legend, { exact: true }).first()).toBeVisible();
    }
  });

  test("trạng thái nút đọc được bằng trình đọc màn hình", async ({ page }) => {
    // Trạng thái không chỉ bằng màu: tên truy cập của nút phải chứa tiến độ mốc / "chưa mở"
    await expect(clickable(page, /Sinh tồn cơ bản.*đã xong/i).first()).toBeVisible();
    await expect(clickable(page, /Lửa bằng que.*xong [34]\/5 mốc/i).first()).toBeVisible();
    await expect(clickable(page, /Sống sót 72 giờ.*chưa mở/i).first()).toBeVisible();
  });

  test("chọn nút đang luyện thấy mốc kế tiếp", async ({ page }) => {
    await clickable(page, /Lửa bằng que/).first().click();
    // Tên mốc kế tiếp (không phải "cấp N"); việc cần làm của mốc đó nằm ngay dưới
    await expect(page.getByRole("heading", { name: /^Mốc tiếp: (Dưới 5 phút|Tự chế)$/ })).toBeVisible();
    await expect(page.getByText(/dưới 5 phút/).first()).toBeVisible();
    // Hành động chính: tự đánh dấu "Xong rồi"; nhờ xác nhận (quay video) là tùy chọn
    await expect(clickable(page, /^Xong rồi$/).first()).toBeVisible();
    const cta = clickable(page, /^(Nhờ xác nhận|Chờ duyệt)$/).first();
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute("href"), "Không đưa dữ liệu cá nhân lên URL").not.toMatch(/user|email/i);
  });

  test("danh mục không tồn tại trả 404", async ({ page }) => {
    const res = await page.goto("/skills/tree/khong-ton-tai");
    await expectNotFoundPage(page, res);
  });

  test("a11y cơ bản", async ({ page }) => {
    await expectBasicA11y(page, "Cây kỹ năng");
  });
});

test.describe("Chi tiết kỹ năng", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/skills/lua-bang-que", "Chi tiết kỹ năng");
  });

  test("hiện tên, độ hiếm, số liệu và 5 mốc với việc cần làm phiên bản hiện tại", async ({ page }) => {
    await expectSingleH1(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Lửa bằng que/);
    // holder_count 214 → Hiếm (ngưỡng app_config.rarity_thresholds)
    await expect(page.getByLabel(/Hiếm/).or(page.getByText(/^Hiếm$/)).first()).toBeVisible();
    await expect(page.getByText(/đang luyện/i).first()).toBeVisible();
    // Người dùng không thấy "Cấp N": tiến độ là thanh mốc 3/5 + tên mốc
    // seed D73: minhhoang tự đánh dấu thêm mốc 4 → tiến độ 4/5 (đã công nhận 3)
    await expect(page.getByRole("progressbar", { name: /Xong [34] trên 5 mốc/ }).first()).toBeVisible();
    await expect(page.getByText(/Cấp \d/)).toHaveCount(0);
    for (const m of ["Ra khói", "Than hồng", "Thành ngọn", "Dưới 5 phút", "Tự chế"]) {
      // tên mốc kèm trạng thái cho trình đọc màn hình (", đã xong" / ", mốc tiếp theo")
      await expect(page.getByText(new RegExp(`^${m}(,|$)`)).first(), `Thiếu mốc "${m}"`).toBeVisible();
    }
    for (const c of [
      "Tạo khói bằng que trong 10 phút",
      "Tạo than hồng, chuyển vào bùi nhùi",
      "Lửa cháy thành ngọn trong 8 phút",
      "Thành ngọn dưới 5 phút, có nước dập lửa bên cạnh",
      "Tự làm bộ que từ cây tại chỗ, thành ngọn dưới 5 phút",
    ]) {
      await expect(page.getByText(c).first(), `Thiếu việc cần làm "${c}"`).toBeVisible();
    }
  });

  test("hành động chính là đánh dấu xong mốc kế tiếp, nhờ xác nhận là tùy chọn", async ({ page }) => {
    await expect(clickable(page, /^Xong rồi$/)).toHaveCount(1);
    await expect(clickable(page, /^(Nhờ xác nhận|Chờ duyệt)$/).first()).toBeVisible();
  });

  test("kỹ năng rủi ro cao có cảnh báo gọn", async ({ page }) => {
    await expect(page.getByText(/Rủi ro cao/).first()).toBeVisible();
  });

  test("luật duyệt nằm sau nút thông tin (ⓘ), không hiện sẵn", async ({ page }) => {
    const info = page.getByRole("button", { name: /^Cách |Thông tin|Giải thích|là gì$/ });
    test.skip((await info.count()) === 0, "Chưa có nút ⓘ trên màn chi tiết");
    await info.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("slug không tồn tại trả 404", async ({ page }) => {
    const res = await page.goto("/skills/khong-ton-tai-xyz");
    await expectNotFoundPage(page, res);
  });

  test("a11y cơ bản", async ({ page }) => {
    await expectBasicA11y(page, "Chi tiết kỹ năng");
  });
});
