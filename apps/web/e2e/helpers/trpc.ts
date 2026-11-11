import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

/** Gọi tRPC qua HTTP (giả lập mobile: Bearer token từ /api/dev/login). Dữ liệu bọc superjson `{ json }`. */
export async function devToken(request: APIRequestContext, handle: string): Promise<string> {
  let res = await request.post("/api/dev/login", { data: { handle }, failOnStatusCode: false });
  // next dev có thể trả 500 thoáng qua khi đang biên dịch lại file người khác vừa sửa → thử lại.
  for (let i = 0; i < 4 && res.status() >= 500; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    res = await request.post("/api/dev/login", { data: { handle }, failOnStatusCode: false });
  }
  test.skip(res.status() === 404 && !(res.headers()["content-type"] ?? "").includes("json"), "Chưa có đăng nhập dev");
  expect(res.ok(), `Đăng nhập dev ${handle}: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { sessionToken: string }).sessionToken;
}

export type TrpcResult = { status: number; data: unknown; error: { code?: string; message?: string } | null; raw: string };

async function parse(res: APIResponse): Promise<TrpcResult> {
  const raw = await res.text();
  let body: { result?: { data?: { json?: unknown } }; error?: { json?: { message?: string; data?: { code?: string } } } } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* không phải JSON */
  }
  const err = body.error?.json;
  return {
    status: res.status(),
    data: body.result?.data?.json,
    error: err ? { code: err.data?.code, message: err.message } : null,
    raw,
  };
}

/** Procedure chưa tồn tại → skip test có ghi chú (api đang làm song song). */
export function skipIfNoProcedure(r: TrpcResult, path: string): void {
  test.skip(r.status === 404 && /No procedure found/i.test(r.raw), `Procedure ${path} chưa có — chờ api`);
}

export async function trpcQuery(request: APIRequestContext, token: string | null, path: string, input?: unknown) {
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await request.get(`/api/trpc/${path}${qs}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    failOnStatusCode: false,
  });
  return parse(res);
}

export async function trpcMutation(request: APIRequestContext, token: string | null, path: string, input?: unknown) {
  const res = await request.post(`/api/trpc/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    data: { json: input ?? null },
    failOnStatusCode: false,
  });
  return parse(res);
}
