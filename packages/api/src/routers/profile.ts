import { getProfile, listUserSkills } from "@skillverse/domain";
import { profileByHandleInput } from "@skillverse/validation";
import { protectedProcedure, router } from "../trpc";

export const profileRouter = router({
  /** Hồ sơ của tôi. */
  me: protectedProcedure.query(({ ctx }) => getProfile(ctx.db, { userId: ctx.user.id, viewerId: ctx.user.id })),

  /** Hồ sơ người khác theo handle (handle là công khai, không phải dữ liệu cá nhân). */
  byHandle: protectedProcedure
    .input(profileByHandleInput)
    .query(({ ctx, input }) => getProfile(ctx.db, { handle: input.handle, viewerId: ctx.user.id })),

  /** Toàn bộ kỹ năng cấp ≥ 1 của một người (đề nghị trao đổi "Bạn dạy / Họ dạy"). */
  skills: protectedProcedure
    .input(profileByHandleInput)
    .query(({ ctx, input }) => listUserSkills(ctx.db, { handle: input.handle })),
});
