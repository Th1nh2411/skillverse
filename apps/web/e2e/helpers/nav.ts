import { expect, test, type Page } from "@playwright/test";

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
