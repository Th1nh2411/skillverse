import { test, type Page } from "@playwright/test";

/**
 * Đăng nhập dev bằng handle seed (chỉ khi AUTH_DEV_LOGIN=true) — việc A1.2 của api.
 *
 * Hợp đồng (apps/web/app/api/dev/login/route.ts của api):
 *   POST /api/dev/login  JSON { handle } → 200 { ok, user, sessionToken, expires } + Set-Cookie phiên.
 *   404 không có body JSON = endpoint chưa có / AUTH_DEV_LOGIN tắt; 404 JSON = không tìm thấy handle.
 * Nếu endpoint chưa tồn tại → test bị skip có ghi chú thay vì fail.
 */
export const DEV_LOGIN_PATHS = process.env.E2E_DEV_LOGIN_PATH
  ? [process.env.E2E_DEV_LOGIN_PATH]
  : ["/api/dev/login"];

export type SeedHandle =
  | "minhhoang"
  | "quocbao"
  | "thuha"
  | "lanphuong"
  | "bientap"
  | "ducanh"
  | "maianh"
  | "tuankiet"
  | "ngoclan"
  | "hoangnam"
  | "nguoimoi";

/** Đăng nhập dev (cookie phiên gắn vào context của page). Skip test hiện tại nếu endpoint chưa có. */
export async function loginAs(page: Page, handle: SeedHandle): Promise<void> {
  const tried: string[] = [];
  for (const p of DEV_LOGIN_PATHS) {
    // page.request dùng chung cookie jar với BrowserContext → cookie phiên áp dụng cho trang.
    const res = await page.request.post(p, {
      data: { handle },
      headers: { "content-type": "application/json" },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    tried.push(`${p} → ${res.status()}`);
    const isJson = (res.headers()["content-type"] ?? "").includes("application/json");
    if ((res.status() === 404 && !isJson) || res.status() === 405) continue;
    if (res.status() >= 400) {
      throw new Error(`Đăng nhập dev "${handle}" thất bại: ${p} → ${res.status()} ${await res.text()}`);
    }
    const cookies = await page.context().cookies();
    if (cookies.some((c) => /session/i.test(c.name))) return;
    throw new Error(`Đăng nhập dev "${handle}" không đặt cookie phiên (${p} → ${res.status()})`);
  }
  test.skip(true, `Chưa có endpoint đăng nhập dev (A1.2 của api). Đã thử: ${tried.join(", ")}`);
}
