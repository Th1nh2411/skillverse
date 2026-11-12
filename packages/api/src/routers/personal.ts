/** Tiến độ cá nhân: tự đánh dấu mốc (D73) và mục đã lưu (D74). Chỉ thao tác trên dữ liệu của chính người dùng. */
import { checkMilestone, listSaved, toggleSave, uncheckMilestone } from "@skillverse/domain";
import { milestoneCheckInput, savedListInput, saveToggleInput } from "@skillverse/validation";
import { protectedProcedure, router } from "../trpc";

export const milestoneRouter = router({
  /** Tự đánh dấu xong một mốc (theo thứ tự; không XP; không đổi level đã xác thực). */
  check: protectedProcedure
    .input(milestoneCheckInput)
    .mutation(({ ctx, input }) => checkMilestone(ctx.db, { userId: ctx.user.id, skillLevelId: input.skillLevelId })),

  /** Bỏ đánh dấu mốc tự đánh dấu cao nhất (không bỏ được mốc đã xác thực). */
  uncheck: protectedProcedure
    .input(milestoneCheckInput)
    .mutation(({ ctx, input }) => uncheckMilestone(ctx.db, { userId: ctx.user.id, skillLevelId: input.skillLevelId })),
});

export const saveRouter = router({
  /** Bật/tắt lưu. Trả { saved }. */
  toggle: protectedProcedure
    .input(saveToggleInput)
    .mutation(({ ctx, input }) => toggleSave(ctx.db, { userId: ctx.user.id, targetType: input.targetType, targetId: input.targetId })),

  /** Mục đã lưu của tôi (mới nhất trước). */
  list: protectedProcedure
    .input(savedListInput)
    .query(({ ctx, input }) => listSaved(ctx.db, { userId: ctx.user.id, cursor: input.cursor, limit: input.limit })),
});
