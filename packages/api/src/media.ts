/**
 * Điều phối upload/xem video bằng chứng ở tầng api (hạ tầng lưu trữ + kiểm tra quyền).
 * Ngưỡng đọc từ app_config.media_limits (không hard-code).
 */
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@skillverse/db";
import { getConfig, type MediaLimits } from "@skillverse/domain";
import type { SessionUser } from "./context";
import { isProofMediaKeyOwnedBy, newProofMediaKey, type Storage } from "./storage";

/** Thời hạn URL upload (giây). Đây là tham số kỹ thuật, không phải ngưỡng nghiệp vụ. */
export const UPLOAD_URL_TTL_S = 15 * 60;
/** Thời hạn URL xem video (giây). */
export const VIEW_URL_TTL_S = 10 * 60;

export function getMediaLimits(db: PrismaClient): Promise<MediaLimits> {
  return getConfig<MediaLimits>(db, "media_limits");
}

function bad(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** Cấp URL PUT có thời hạn cho một file video sắp tải lên. */
export async function createProofUpload(
  ctx: { db: PrismaClient; storage: Storage; user: SessionUser },
  input: { contentType: string; sizeBytes: number },
) {
  const limits = await getMediaLimits(ctx.db);
  const maxBytes = limits.max_mb * 1024 * 1024;
  const contentType = input.contentType.split(";")[0]!.trim().toLowerCase();
  if (!limits.allowed_types.includes(contentType)) bad("Định dạng video không được hỗ trợ.");
  if (input.sizeBytes > maxBytes) bad(`Video tối đa ${limits.max_mb} MB.`);
  const key = newProofMediaKey(ctx.user.id, contentType);
  const uploadUrl = await ctx.storage.presignPut(key, contentType, UPLOAD_URL_TTL_S);
  return {
    mediaKey: key,
    uploadUrl,
    method: "PUT" as const,
    headers: { "Content-Type": contentType },
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_S * 1000),
    maxBytes,
    maxSeconds: limits.max_seconds,
  };
}

/**
 * Sau khi client PUT xong: xác minh khóa thuộc người nộp, object tồn tại, đúng giới hạn,
 * rồi tính SHA-256 ở server (D20). Object sai giới hạn bị xóa.
 */
export async function verifyUploadedProofMedia(
  ctx: { db: PrismaClient; storage: Storage; user: SessionUser },
  mediaKey: string,
): Promise<{ mediaHash: string; sizeBytes: number; contentType: string }> {
  if (!isProofMediaKeyOwnedBy(mediaKey, ctx.user.id)) bad("Video không hợp lệ. Hãy tải lên lại.");
  const reused = await ctx.db.proof.findFirst({ where: { mediaUrl: mediaKey }, select: { id: true } });
  if (reused) bad("Video này đã được dùng cho một bằng chứng khác.");
  const head = await ctx.storage.head(mediaKey);
  if (!head) bad("Chưa tải video lên xong.");
  const limits = await getMediaLimits(ctx.db);
  const contentType = (head.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (head.size <= 0 || head.size > limits.max_mb * 1024 * 1024 || !limits.allowed_types.includes(contentType)) {
    await ctx.storage.delete(mediaKey).catch(() => undefined);
    bad(`Video phải là ${limits.allowed_types.join(", ")} và tối đa ${limits.max_mb} MB.`);
  }
  const mediaHash = await ctx.storage.sha256(mediaKey);
  return { mediaHash, sizeBytes: head.size, contentType };
}

/**
 * Quyền xem video bằng chứng: người nộp, người được phân công duyệt bằng chứng đó,
 * biên tập viên, hoặc bất kỳ ai đã đăng nhập khi bằng chứng đã đạt.
 */
export async function canViewProofMedia(db: PrismaClient, user: SessionUser | null, proofId: string): Promise<boolean> {
  if (!user) return false;
  const proof = await db.proof.findFirst({
    where: { id: proofId, deletedAt: null },
    select: { userId: true, status: true },
  });
  if (!proof) return false;
  if (proof.userId === user.id || user.isEditor || proof.status === "passed") return true;
  const assignment = await db.reviewAssignment.findFirst({
    where: { proofId, reviewerId: user.id, state: { in: ["assigned", "done"] } },
    select: { id: true },
  });
  return assignment !== null;
}

/** URL GET có thời hạn, hoặc FORBIDDEN/NOT_FOUND. */
export async function proofMediaUrl(ctx: { db: PrismaClient; storage: Storage; user: SessionUser | null }, proofId: string) {
  if (!(await canViewProofMedia(ctx.db, ctx.user, proofId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Bạn không có quyền xem video này." });
  }
  const proof = await ctx.db.proof.findUniqueOrThrow({ where: { id: proofId }, select: { mediaUrl: true } });
  return {
    url: await ctx.storage.presignGet(proof.mediaUrl, VIEW_URL_TTL_S),
    expiresAt: new Date(Date.now() + VIEW_URL_TTL_S * 1000),
  };
}
