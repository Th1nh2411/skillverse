import { getPrisma, type PrismaClient, type UserStatus } from "@skillverse/db";
import { getSessionUser, sessionTokenFromHeaders } from "./auth/session";

export type SessionUser = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isEditor: boolean;
  status: UserStatus;
  onboarded: boolean;
};

export type Context = {
  db: PrismaClient;
  user: SessionUser | null;
};

/** Tạo context khi đã biết người dùng (test, server caller). */
export async function createContext(opts: { user: SessionUser | null; db?: PrismaClient }): Promise<Context> {
  return { db: opts.db ?? getPrisma(), user: opts.user };
}

/**
 * Tạo context từ request HTTP: phân giải người dùng từ cookie phiên Auth.js (web)
 * HOẶC header `Authorization: Bearer <session_token>` (mobile). Cùng một session_token.
 */
export async function createContextFromHeaders(headers: Headers, db: PrismaClient = getPrisma()): Promise<Context> {
  const user = await getSessionUser(db, sessionTokenFromHeaders(headers));
  return { db, user };
}
