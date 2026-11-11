import { getPrisma, type PrismaClient } from "@skillverse/db";

export type SessionUser = {
  id: string;
  handle: string;
  displayName: string;
  isEditor: boolean;
  onboarded: boolean;
};

export type Context = {
  db: PrismaClient;
  user: SessionUser | null;
};

/**
 * Tạo context. Phân giải người dùng từ session cookie (web) HOẶC header
 * "Authorization: Bearer <session_token>" (mobile) — đồng đội "api" hoàn thiện.
 */
export async function createContext(opts: { user: SessionUser | null }): Promise<Context> {
  return { db: getPrisma(), user: opts.user };
}
