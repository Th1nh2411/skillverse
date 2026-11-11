import { getPrisma, type PrismaClient, type UserStatus } from "@skillverse/db";
import { getSessionUser, sessionTokenFromHeaders } from "./auth/session";
import { getStorage, type Storage } from "./storage";

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
  /** Kho video (S3/R2/MinIO). Test truyền bản giả. */
  storage: Storage;
};

/** Storage tạo lười: chỉ đọc biến môi trường S3 khi thật sự dùng. */
const lazyStorage: Storage = {
  presignPut: (...a) => getStorage().presignPut(...a),
  presignGet: (...a) => getStorage().presignGet(...a),
  head: (...a) => getStorage().head(...a),
  sha256: (...a) => getStorage().sha256(...a),
  delete: (...a) => getStorage().delete(...a),
};

/** Tạo context khi đã biết người dùng (test, server caller). */
export async function createContext(opts: {
  user: SessionUser | null;
  db?: PrismaClient;
  storage?: Storage;
}): Promise<Context> {
  return { db: opts.db ?? getPrisma(), user: opts.user, storage: opts.storage ?? lazyStorage };
}

/**
 * Tạo context từ request HTTP: phân giải người dùng từ cookie phiên Auth.js (web)
 * HOẶC header `Authorization: Bearer <session_token>` (mobile). Cùng một session_token.
 */
export async function createContextFromHeaders(
  headers: Headers,
  db: PrismaClient = getPrisma(),
  storage: Storage = lazyStorage,
): Promise<Context> {
  const user = await getSessionUser(db, sessionTokenFromHeaders(headers));
  return { db, user, storage };
}
