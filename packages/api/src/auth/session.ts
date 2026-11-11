/**
 * Phân giải phiên đăng nhập dùng chung cho web (cookie Auth.js) và mobile (Bearer).
 * Với session strategy "database", giá trị cookie Auth.js CHÍNH LÀ `auth_sessions.session_token`.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@skillverse/db";
import type { SessionUser } from "../context";

/** Tên cookie phiên Auth.js v5 (bản __Secure- khi chạy https). */
export const SESSION_COOKIE = "authjs.session-token";
export const SECURE_SESSION_COOKIE = `__Secure-${SESSION_COOKIE}`;
/** Trùng mặc định Auth.js (30 ngày). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function parseCookieHeader(header: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && !out.has(k)) {
      try {
        out.set(k, decodeURIComponent(v));
      } catch {
        out.set(k, v);
      }
    }
  }
  return out;
}

/** Lấy session token từ `Authorization: Bearer <token>` (ưu tiên) hoặc cookie phiên. */
export function sessionTokenFromHeaders(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(\S+)$/i.exec(auth.trim());
    if (m) return m[1]!;
  }
  return sessionTokenFromCookies((name) => parseCookieHeader(headers.get("cookie")).get(name));
}

/** Dùng với `cookies()` của Next hoặc bất kỳ nguồn cookie nào. */
export function sessionTokenFromCookies(get: (name: string) => string | undefined): string | null {
  return get(SECURE_SESSION_COOKIE) || get(SESSION_COOKIE) || null;
}

/** Tra phiên còn hạn → người dùng hiện tại. Người bị khóa (banned) / đã xóa → null. */
export async function getSessionUser(db: PrismaClient, token: string | null | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 512) return null;
  const row = await db.authSession.findUnique({
    where: { sessionToken: token },
    select: {
      expires: true,
      user: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          isEditor: true,
          status: true,
          deletedAt: true,
          onboardedAt: true,
        },
      },
    },
  });
  if (!row || row.expires.getTime() <= Date.now()) return null;
  const u = row.user;
  if (u.status === "banned" || u.deletedAt) return null;
  return {
    id: u.id,
    handle: u.handle,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isEditor: u.isEditor,
    status: u.status,
    onboarded: u.onboardedAt !== null,
  };
}

/** Tạo phiên mới cho một người dùng (dùng cho đăng nhập dev và test). */
export async function createSessionFor(
  db: PrismaClient,
  userId: string,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + maxAgeSeconds * 1000);
  await db.authSession.create({ data: { sessionToken, userId, expires } });
  return { sessionToken, expires };
}

/**
 * Bật đăng nhập dev? Cần AUTH_DEV_LOGIN=true, và:
 * - KHÔNG BAO GIỜ trên Vercel production (VERCEL_ENV=production), kể cả khi bật nhầm;
 * - với build production khác (NODE_ENV=production: `next start`, Vercel preview) phải bật rõ thêm
 *   AUTH_DEV_LOGIN_ALLOW_PRODUCTION=true (vd. preview demo / e2e trên bản build).
 */
export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AUTH_DEV_LOGIN !== "true") return false;
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production" && env.AUTH_DEV_LOGIN_ALLOW_PRODUCTION !== "true") return false;
  return true;
}

/** Đăng nhập dev bằng handle seed. Trả null nếu tắt hoặc không có người dùng hợp lệ. */
export async function devLogin(
  db: PrismaClient,
  handle: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ sessionToken: string; expires: Date; user: SessionUser } | null> {
  if (!devLoginEnabled(env)) return null;
  const u = await db.user.findUnique({ where: { handle }, select: { id: true, status: true, deletedAt: true } });
  if (!u || u.status === "banned" || u.deletedAt) return null;
  const s = await createSessionFor(db, u.id);
  const user = await getSessionUser(db, s.sessionToken);
  return user ? { ...s, user } : null;
}
