/**
 * Cấu hình môi trường e2e dùng chung cho playwright.config.ts và global-setup.ts.
 * DB e2e được reset tùy ý — tuyệt đối không trỏ về DB dev `skillverse`.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://skillverse:skillverse@localhost:5433/skillverse_e2e";

/** Secret cron riêng cho e2e (dev server e2e nhận giá trị này, ghi đè .env). */
export const E2E_CRON_SECRET = process.env.E2E_CRON_SECRET ?? "e2e-cron-secret";

export function assertE2eDatabase(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_e2e")) {
    throw new Error(`E2E chỉ được chạy trên DB có hậu tố _e2e (đang là "${dbName}")`);
  }
}

/** Biến môi trường cho dev server e2e và lệnh seed. Ghi đè giá trị trong .env (process env thắng .env). */
export function e2eEnv(): Record<string, string> {
  assertE2eDatabase(E2E_DATABASE_URL);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  return {
    ...env,
    NEXT_DIST_DIR: process.env.E2E_PROD === "1" ? ".next-e2e-prod" : ".next-e2e",
    DATABASE_URL: E2E_DATABASE_URL,
    DIRECT_URL: E2E_DATABASE_URL,
    AUTH_URL: E2E_BASE_URL,
    NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
    AUTH_DEV_LOGIN: "true",
    // E2E_PROD (next start, NODE_ENV=production) vẫn cần đăng nhập dev — cờ opt-in riêng của api, chỉ ở máy local/e2e
    ...(process.env.E2E_PROD === "1" ? { AUTH_DEV_LOGIN_ALLOW_PRODUCTION: "true" } : {}),
    AUTH_TRUST_HOST: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    CRON_SECRET: E2E_CRON_SECRET,
  };
}
