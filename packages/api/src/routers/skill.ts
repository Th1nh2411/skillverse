import { getSkillDetail, getSkillTree, searchSkills } from "@skillverse/domain";
import { skillDetailInput, skillSearchInput, skillTreeInput } from "@skillverse/validation";
import { protectedProcedure, router } from "../trpc";

export const skillRouter = router({
  /** Cây kỹ năng một danh mục, trạng thái nút theo người xem. */
  tree: protectedProcedure
    .input(skillTreeInput)
    .query(({ ctx, input }) => getSkillTree(ctx.db, { userId: ctx.user.id, categorySlug: input.categorySlug })),

  /** Chi tiết kỹ năng: 5 cấp + tiêu chí phiên bản hiện tại, thống kê, đề xuất sửa tiêu chí. */
  detail: protectedProcedure
    .input(skillDetailInput)
    .query(({ ctx, input }) => getSkillDetail(ctx.db, { slug: input.slug, userId: ctx.user.id })),

  /** Tìm kỹ năng theo tên/slug. */
  search: protectedProcedure.input(skillSearchInput).query(({ ctx, input }) => searchSkills(ctx.db, input)),
});
