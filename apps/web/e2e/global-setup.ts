import { execFileSync } from "node:child_process";
import path from "node:path";
import { E2E_BASE_URL, e2eEnv } from "./env";

/**
 * Trước mỗi lượt chạy e2e:
 * 1. áp migration lên DB `skillverse_e2e`, xóa sạch rồi seed lại (SEED_RESET=1) bằng script seed của packages/db;
 * 2. warm-up: `next dev` biên dịch từng route ở lần gọi đầu (có thể > 10 s) → gọi trước mọi màn/procedure
 *    giai đoạn 1 để test không bị timeout ngẫu nhiên. (webServer của Playwright khởi động TRƯỚC globalSetup.)
 * E2E_SKIP_SEED=1 bỏ bước 1; E2E_SKIP_WARMUP=1 bỏ bước 2.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_SEED !== "1") {
    const env: NodeJS.ProcessEnv = { ...process.env, ...e2eEnv(), SEED_RESET: "1" };
    const dbDir = path.resolve(import.meta.dirname, "../../../packages/db");
    const run = (args: string[]) =>
      execFileSync("pnpm", args, { cwd: dbDir, env, stdio: ["ignore", "inherit", "inherit"] });
    run(["exec", "prisma", "migrate", "deploy"]);
    run(["run", "seed"]);
  }
  if (process.env.E2E_SKIP_WARMUP !== "1") await warmUp();
}

const WARM_PAGES: Array<[handle: string | null, path: string]> = [
  [null, "/login"],
  ["nguoimoi", "/onboarding"],
  ["minhhoang", "/home"],
  ["minhhoang", "/profile"],
  ["minhhoang", "/skills/tree/sinh-ton"],
  ["minhhoang", "/skills/lua-bang-que"],
  ["minhhoang", "/discover"],
];

const trpc = (p: string, input: unknown) =>
  `/api/trpc/${p}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;

const WARM_API: string[] = [
  trpc("discover.home", {}),
  trpc("skill.search", { query: "nút", limit: 5 }),
  trpc("profile.me", undefined),
  trpc("onboarding.options", undefined),
];

async function devLoginCookie(handle: string): Promise<string | null> {
  const res = await fetch(`${E2E_BASE_URL}/api/dev/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle }),
    signal: AbortSignal.timeout(180_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const set = res.headers.getSetCookie().find((c) => /session-token=/.test(c));
  return set ? set.split(";")[0]! : null;
}

async function warmUp(): Promise<void> {
  const started = Date.now();
  const cookies = new Map<string, string | null>();
  const cookieFor = async (h: string) => {
    if (!cookies.has(h)) cookies.set(h, await devLoginCookie(h));
    return cookies.get(h) ?? null;
  };
  const get = async (url: string, cookie: string | null) => {
    try {
      const res = await fetch(`${E2E_BASE_URL}${url}`, {
        headers: cookie ? { cookie } : {},
        redirect: "manual",
        signal: AbortSignal.timeout(180_000),
      });
      await res.arrayBuffer();
      return res.status;
    } catch {
      return 0;
    }
  };
  const report: string[] = [];
  for (const [handle, p] of WARM_PAGES) {
    report.push(`${p} ${await get(p, handle ? await cookieFor(handle) : null)}`);
  }
  const me = await cookieFor("minhhoang");
  for (const u of WARM_API) report.push(`${u.split("?")[0]} ${await get(u, me)}`);
  console.log(`[e2e warm-up ${Math.round((Date.now() - started) / 1000)}s] ${report.join(", ")}`);
}
