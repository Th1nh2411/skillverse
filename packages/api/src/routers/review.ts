import { getReviewQueue, getReviewTask, reportProofDuringReview, submitReview } from "@skillverse/domain";
import { reportDuringReviewInput, reviewTaskInput, submitReviewInput } from "@skillverse/validation";
import { VIEW_URL_TTL_S } from "../media";
import { protectedProcedure, router } from "../trpc";

export const reviewRouter = router({
  /** Hàng đợi duyệt của tôi (ẩn danh người nộp). */
  queue: protectedProcedure.query(({ ctx }) => getReviewQueue(ctx.db, { reviewerId: ctx.user.id })),

  /**
   * Một lượt duyệt: tiêu chí, video (URL có thời hạn). Chỉ người được phân công (domain kiểm tra);
   * không trả proofId / người nộp, không trả khóa object.
   */
  task: protectedProcedure.input(reviewTaskInput).query(async ({ ctx, input }) => {
    const { mediaKey, ...task } = await getReviewTask(ctx.db, { assignmentId: input.assignmentId, reviewerId: ctx.user.id });
    const canView = task.state === "assigned" || task.state === "done";
    const video = canView
      ? { url: await ctx.storage.presignGet(mediaKey, VIEW_URL_TTL_S), expiresAt: new Date(Date.now() + VIEW_URL_TTL_S * 1000) }
      : null;
    return { ...task, video };
  }),

  /** Chấm từng tiêu chí + kết luận. Đủ phiếu thì domain chốt kết quả (finalizeProof). */
  submit: protectedProcedure.input(submitReviewInput).mutation(async ({ ctx, input }) => {
    const r = await submitReview(ctx.db, {
      assignmentId: input.assignmentId,
      reviewerId: ctx.user.id,
      verdict: input.verdict,
      marks: input.marks,
      comment: input.comment ?? null,
    });
    // Không lộ proofId / người duyệt khác cho người duyệt; chỉ báo vòng duyệt đã chốt hay chưa.
    return { reviewId: r.reviewId, xpAwarded: r.xpAwarded, quest: r.quest, outcome: r.finalize.outcome };
  }),

  /** Báo cáo gian lận trong lúc duyệt. */
  report: protectedProcedure.input(reportDuringReviewInput).mutation(({ ctx, input }) =>
    reportProofDuringReview(ctx.db, {
      assignmentId: input.assignmentId,
      reviewerId: ctx.user.id,
      reason: input.reason,
      details: input.details ?? null,
    }),
  ),
});
