import { execFileSync } from "node:child_process";
import path from "node:path";
import { e2eEnv } from "./env";

/**
 * Trước mỗi lượt chạy e2e: áp migration lên DB `skillverse_e2e`, xóa sạch rồi seed lại (SEED_RESET=1).
 * Dùng chính script seed của packages/db để dữ liệu e2e trùng dữ liệu demo.
 * E2E_SKIP_SEED=1 để bỏ qua (khi chạy lặp nhanh một test không đổi dữ liệu).
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === "1") return;
  const env: NodeJS.ProcessEnv = { ...process.env, ...e2eEnv(), SEED_RESET: "1" };
  const dbDir = path.resolve(import.meta.dirname, "../../../packages/db");
  const run = (args: string[]) =>
    execFileSync("pnpm", args, { cwd: dbDir, env, stdio: ["ignore", "inherit", "inherit"] });
  run(["exec", "prisma", "migrate", "deploy"]);
  run(["run", "seed"]);
}
