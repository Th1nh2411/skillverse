import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, e2eEnv } from "./e2e/env";

/**
 * E2E SkillVerse — chạy trên DB riêng `skillverse_e2e` (được reset + seed trong global-setup).
 * Dev server: `next dev` cổng 3200, thư mục build `.next-e2e` để không tranh với ui (3100) / api (3300).
 *
 * Chạy: pnpm e2e  (hoặc pnpm --filter @skillverse/web exec playwright test)
 * E2E_REUSE_SERVER=1 để dùng lại server đang chạy ở cổng 3200.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  globalSetup: "./e2e/global-setup.ts",
  // Các test dùng chung một DB seed; chạy tuần tự để không giẫm chân nhau (onboarding thay đổi dữ liệu).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "./e2e/.results",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Thiết bị chính: điện thoại 390px (SKILL.md: đẹp ở 360px và 390px)
      name: "mobile-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true },
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${E2E_PORT}`,
    // Không dùng / (redirect tới /login có thể 404 khi màn chưa dựng) — manifest luôn 200 và không cần đăng nhập
    url: `${E2E_BASE_URL}/manifest.webmanifest`,
    // Next dev biên dịch lần đầu khá lâu
    timeout: 180_000,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    stdout: process.env.E2E_SERVER_LOG === "1" ? "pipe" : "ignore",
    stderr: "pipe",
    env: e2eEnv(),
  },
});
