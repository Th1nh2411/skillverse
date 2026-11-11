import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./root";

export { appRouter, type AppRouter } from "./root";
export { createContext, createContextFromHeaders, type Context, type SessionUser } from "./context";
export { createCallerFactory } from "./trpc";
export { createAuthAdapter } from "./auth/adapter";
export { generateUniqueHandle, handleBase } from "./auth/handle";
export {
  SESSION_COOKIE,
  SECURE_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionFor,
  devLogin,
  devLoginEnabled,
  getSessionUser,
  sessionTokenFromCookies,
  sessionTokenFromHeaders,
} from "./auth/session";

/** Kiểu input/output của mọi procedure — UI dùng: `RouterOutputs["profile"]["me"]`. */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export {
  S3Storage,
  getStorage,
  s3EnvFromProcess,
  newProofMediaKey,
  isProofMediaKeyOwnedBy,
  type Storage,
  type S3Env,
} from "./storage";
export { canViewProofMedia, createProofUpload, verifyUploadedProofMedia, proofMediaUrl, UPLOAD_URL_TTL_S, VIEW_URL_TTL_S } from "./media";
export { runCron, verifyCronSecret, CRON_JOBS, type CronReport } from "./cron";
