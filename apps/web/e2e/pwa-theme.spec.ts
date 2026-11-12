import { expect, test } from "@playwright/test";
import { expectBasicA11y } from "./helpers/a11y";
import { loginAs } from "./helpers/auth";
import { gotoScreen } from "./helpers/nav";

/** Giai đoạn 5 — kiểm tra nhanh: manifest PWA, trang ngoại tuyến (không cache API), giao diện sáng. */
const PROD = process.env.E2E_PROD === "1";

test.describe("PWA", () => {
  test("manifest: tiếng Việt, standalone, icon PNG 192/512 + maskable tải được", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = (await res.json()) as {
      name: string;
      lang?: string;
      display: string;
      start_url: string;
      icons: { src: string; sizes: string; type?: string; purpose?: string }[];
    };
    expect(m.name).toBe("SkillVerse");
    expect(m.lang).toBe("vi");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toMatch(/^\//);
    for (const size of ["192x192", "512x512"]) {
      expect(m.icons.some((i) => i.sizes === size && i.type === "image/png"), `Thiếu icon PNG ${size}`).toBe(true);
    }
    expect(m.icons.some((i) => i.purpose?.includes("maskable")), "Thiếu icon maskable").toBe(true);
    for (const icon of m.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toContain(icon.type ?? "image/");
    }
  });

  test("service worker: mất mạng hiện trang ngoại tuyến, không cache API", async ({ page, context }) => {
    test.skip(!PROD, "Service worker chỉ đăng ký ở production — chạy với E2E_PROD=1");
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/home", "Trang chủ");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Trang phải được SW điều khiển (reload sau khi SW claim)
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // Tạo vài lượt gọi API để chắc chúng không bị cache
    await gotoScreen(page, "/discover", "Khám phá");
    await expect(page.getByRole("heading", { name: /Hiếm nhất/ })).toBeVisible({ timeout: 30_000 });

    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        for (const r of await c.keys()) urls.push(new URL(r.url).pathname);
      }
      return urls;
    });
    expect(cached.filter((u) => u.startsWith("/api/")), "SW không được cache API").toEqual([]);

    await context.setOffline(true);
    try {
      await page.goto("/profile").catch(() => undefined);
      await expect(page.getByText(/Bạn đang ngoại tuyến/).first()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe("Giao diện sáng", () => {
  test("bật trong Cài đặt → html[data-theme=light], nhớ qua tải lại, a11y cơ bản", async ({ page, context }) => {
    await loginAs(page, "minhhoang");
    await gotoScreen(page, "/profile", "Hồ sơ");
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole("button", { name: "Cài đặt" }).click();
    const sw = page.getByRole("switch", { name: /Giao diện sáng/ });
    await expect(sw).toBeVisible();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "sv-theme")?.value).toBe("light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(lightBg, "Nền phải đổi khi sang giao diện sáng").not.toBe(darkBg);
    await expectBasicA11y(page, "Hồ sơ (giao diện sáng)");

    // Tắt lại
    await page.getByRole("button", { name: "Cài đặt" }).click();
    await page.getByRole("switch", { name: /Giao diện sáng/ }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
  });
});
