import { expect, test, type Page, type Response } from "@playwright/test";

/**
 * Trang "không tìm thấy / không có quyền" (app/not-found.tsx: h1 "Lạc đường rồi").
 * Từ khi có loading.tsx (streaming), notFound() trong page gửi sau phần khung → HTTP 200 kèm meta robots noindex
 * (hành vi của Next). Vì vậy kiểm theo nội dung: đúng trang not-found HOẶC status 404.
 */
export async function expectNotFoundPage(page: Page, res: Response | null): Promise<void> {
  if (res?.status() === 404) return;
  await expect(page.getByRole("heading", { level: 1, name: "Lạc đường rồi" })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
}

/**
 * Mở một màn; nếu route chưa được dựng (404) thì skip có ghi chú — màn giai đoạn 1 đang làm song song.
 * Trả về URL cuối cùng (sau redirect).
 */
export async function gotoScreen(page: Page, path: string, screenName: string): Promise<string> {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = res?.status() ?? 0;
  if (status === 404 || (await page.getByText(/This page could not be found/i).count()) > 0) {
    test.skip(true, `Màn "${screenName}" (${path}) chưa có (404) — chờ ui`);
  }
  // Trang not-found tùy biến (status 200 khi streaming) trên một màn đáng lẽ phải có → lỗi thật, không skip
  await expect(page.getByRole("heading", { level: 1, name: "Lạc đường rồi" }), `${path} hiện trang không tìm thấy`).toHaveCount(0);
  expect(status, `${path} trả về lỗi máy chủ`).toBeLessThan(500);
  // Chờ hydrate + truy vấn tRPC đầu tiên xong: thao tác trước khi React hydrate sẽ bị mất (input điều khiển).
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  return page.url();
}

/** Mỗi màn phải có đúng một tiêu đề h1 không rỗng. */
export async function expectSingleH1(page: Page): Promise<void> {
  const h1 = page.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).not.toHaveText(/^\s*$/);
}
