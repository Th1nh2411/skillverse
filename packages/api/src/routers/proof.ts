import { fileAppeal, getLevelUpSummary, getProofStatus, getShareCard, submitProof } from "@skillverse/domain";
import { fileAppealInput, proofCreateUploadInput, proofIdInput, submitProofInput } from "@skillverse/validation";
import { createProofUpload, proofMediaUrl, verifyUploadedProofMedia } from "../media";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const proofRouter = router({
  /** Bước 1: xin URL PUT có thời hạn để tải video thẳng lên kho. */
  createUpload: protectedProcedure
    .input(proofCreateUploadInput)
    .mutation(({ ctx, input }) => createProofUpload(ctx, input)),

  /** Bước 2: sau khi PUT xong, nộp bằng chứng. Server tự tính SHA-256 của file (D20). */
  submit: protectedProcedure.input(submitProofInput).mutation(async ({ ctx, input }) => {
    const media = await verifyUploadedProofMedia(ctx, input.mediaKey);
    const r = await submitProof(ctx.db, {
      userId: ctx.user.id,
      skillId: input.skillId,
      targetLevel: input.targetLevel,
      mediaUrl: input.mediaKey,
      mediaHash: media.mediaHash,
      contentType: media.contentType,
      sizeBytes: media.sizeBytes,
      durationS: input.durationS ?? null,
      capturedAt: input.capturedAt ?? null,
      caption: input.caption ?? null,
      safetyAck: input.safetyAck,
    });
    // Không trả danh tính người duyệt cho người nộp.
    return { proofId: r.proofId, status: r.status, duplicate: r.duplicate, reviewersAssigned: r.assignedReviewerIds.length };
  }),

  /** Trạng thái bằng chứng của tôi (hoặc biên tập viên), kèm URL xem video có thời hạn. */
  status: protectedProcedure.input(proofIdInput).query(async ({ ctx, input }) => {
    const { mediaKey: _mediaKey, ...view } = await getProofStatus(ctx.db, {
      proofId: input.proofId,
      userId: ctx.user.id,
      isEditor: ctx.user.isEditor,
    });
    return { ...view, video: await proofMediaUrl(ctx, input.proofId) };
  }),

  /** URL xem video có thời hạn: người nộp, người được phân công, biên tập viên, hoặc bằng chứng đã đạt. */
  videoUrl: protectedProcedure.input(proofIdInput).query(({ ctx, input }) => proofMediaUrl(ctx, input.proofId)),

  /** Kháng nghị một lần cho bằng chứng bị trượt. */
  appeal: protectedProcedure
    .input(fileAppealInput)
    .mutation(({ ctx, input }) => fileAppeal(ctx.db, { proofId: input.proofId, userId: ctx.user.id, reason: input.reason })),
});

export const levelUpRouter = router({
  /** Màn Lên cấp (chỉ chủ bằng chứng đã đạt). */
  summary: protectedProcedure
    .input(proofIdInput)
    .query(({ ctx, input }) => getLevelUpSummary(ctx.db, { proofId: input.proofId, userId: ctx.user.id })),
});

export const shareRouter = router({
  /** Dữ liệu công khai cho trang /share/[proofId] (không cần đăng nhập; chỉ bằng chứng đã đạt). */
  card: publicProcedure.input(proofIdInput).query(({ ctx, input }) => getShareCard(ctx.db, { proofId: input.proofId })),
});
