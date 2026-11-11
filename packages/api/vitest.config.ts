import { defineConfig } from "vitest/config";

/**
 * Test router chạy trên DB riêng `skillverse_test_api` (cùng quy ước *_test của domain) để
 * không đụng độ khi turbo chạy test domain và api song song. globalSetup tự tạo DB + migrate.
 */
const TEST_DATABASE_URL =
  process.env.API_TEST_DATABASE_URL ?? "postgresql://skillverse:skillverse@localhost:5433/skillverse_test_api";
// globalSetup chạy trong tiến trình chính (không nhận test.env) → đặt luôn ở đây.
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: { TEST_DATABASE_URL, AUTH_DEV_LOGIN: "false", AUTH_SECRET: "test-only-secret" },
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
