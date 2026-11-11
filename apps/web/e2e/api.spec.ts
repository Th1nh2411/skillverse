import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Kiểm tra API tRPC ở mức HTTP (giả lập client mobile dùng Bearer):
 * quyền ở server, validate input, không lộ dữ liệu cá nhân của người khác.
 */
const q = (path: string, input?: unknown) =>
  `/api/trpc/${path}${input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`}`;

async function bearer(request: APIRequestContext, handle: string): Promise<string> {
  const res = await request.post("/api/dev/login", { data: { handle }, failOnStatusCode: false });
  test.skip(res.status() === 404 && !(res.headers()["content-type"] ?? "").includes("json"), "Chưa có đăng nhập dev");
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { sessionToken: string }).sessionToken;
}

test.describe("API tRPC", () => {
  test("chưa đăng nhập bị chặn ở các procedure giai đoạn 1", async ({ request }) => {
    for (const path of ["profile.me", "skill.search", "discover.home", "onboarding.options"]) {
      const res = await request.get(q(path), { failOnStatusCode: false });
      expect(res.status(), `${path} phải trả 401 khi chưa đăng nhập`).toBe(401);
    }
  });

  test("Bearer token dùng được cho profile.me", async ({ request }) => {
    const token = await bearer(request, "minhhoang");
    const res = await request.get(q("profile.me"), { headers: { authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.result.data.json.handle).toBe("minhhoang");
  });

  test("hồ sơ người khác không lộ email / vị trí", async ({ request }) => {
    const token = await bearer(request, "minhhoang");
    const res = await request.get(q("profile.byHandle", { handle: "thuha" }), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("thuha");
    expect(text).not.toMatch(/@demo\.skillverse\.local|"email"|homeCell|home_cell|shareLocation/);
  });

  test("input sai định dạng bị Zod chặn (400)", async ({ request }) => {
    const token = await bearer(request, "minhhoang");
    const res = await request.get(q("profile.byHandle", { handle: "A B!" }), {
      headers: { authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test("onboarding.complete chặn khi chọn ít hơn 3 kỹ năng", async ({ request }) => {
    const token = await bearer(request, "nguoimoi");
    const res = await request.post("/api/trpc/onboarding.complete", {
      headers: { authorization: `Bearer ${token}` },
      data: { json: { skillIds: ["00000000-0000-4000-8000-000000000000"] } },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });
});
