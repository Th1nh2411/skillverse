import { expect, test } from "@playwright/test";
import { E2E_CRON_SECRET } from "./env";

/** Q2.3 — POST /api/cron chỉ chạy khi đúng secret (Bearer hoặc x-cron-secret). */
test.describe("Cron", () => {
  test.beforeEach(async ({ request }) => {
    const probe = await request.post("/api/cron", { failOnStatusCode: false });
    test.skip(probe.status() === 404, "Chưa có /api/cron (A2.3) — chờ api");
  });

  test("thiếu hoặc sai secret → 401", async ({ request }) => {
    const variants: Record<string, string>[] = [{}, { authorization: "Bearer sai-secret" }, { "x-cron-secret": "sai-secret" }, { authorization: `Bearer ${E2E_CRON_SECRET}x` }];
    for (const headers of variants) {
      const res = await request.post("/api/cron", { headers, failOnStatusCode: false });
      expect(res.status(), `headers ${JSON.stringify(headers)}`).toBe(401);
    }
  });

  test("GET không chạy job", async ({ request }) => {
    const res = await request.get("/api/cron", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` }, failOnStatusCode: false });
    expect([401, 404, 405]).toContain(res.status());
  });

  test("đúng secret → 200 (Bearer và x-cron-secret), chạy lại vẫn 200 (idempotent)", async ({ request }) => {
    const a = await request.post("/api/cron", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` }, failOnStatusCode: false });
    expect(a.status(), await a.text()).toBe(200);
    const b = await request.post("/api/cron", { headers: { "x-cron-secret": E2E_CRON_SECRET }, failOnStatusCode: false });
    expect(b.status()).toBe(200);
  });
});
