/**
 * Server caller cho React Server Components / server actions.
 *   const api = await getServerCaller();
 *   const profile = await api.profile.me();
 * Context phân giải người dùng từ cookie phiên (giống /api/trpc).
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  appRouter,
  createCallerFactory,
  createContext,
  getSessionUser,
  sessionTokenFromCookies,
  type SessionUser,
} from "@skillverse/api";
import { getPrisma } from "@skillverse/db";

const createCaller = createCallerFactory(appRouter);

/** Người dùng hiện tại (null nếu chưa đăng nhập). Cache theo request. */
export const getViewer = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  let token = sessionTokenFromCookies((name) => jar.get(name)?.value);
  if (!token) {
    const auth = (await headers()).get("authorization");
    const m = auth ? /^Bearer\s+(\S+)$/i.exec(auth.trim()) : null;
    token = m?.[1] ?? null;
  }
  return getSessionUser(getPrisma(), token);
});

/** tRPC caller phía server, cache theo request. */
export const getServerCaller = cache(async () => {
  const ctx = await createContext({ user: await getViewer() });
  return createCaller(ctx);
});
