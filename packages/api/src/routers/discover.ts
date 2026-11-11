import { listCategories, nearbyPeople, rarestSkills, trendingSkills } from "@skillverse/domain";
import { discoverHomeInput } from "@skillverse/validation";
import { protectedProcedure, router } from "../trpc";

export const discoverRouter = router({
  /** Màn Khám phá: hiếm nhất, thịnh hành, người gần bạn (không lộ vị trí), danh mục. */
  home: protectedProcedure.input(discoverHomeInput).query(async ({ ctx, input }) => {
    const { categorySlug } = input;
    const [rarest, trending, nearby, categories] = await Promise.all([
      rarestSkills(ctx.db, { categorySlug }),
      trendingSkills(ctx.db, { categorySlug }),
      nearbyPeople(ctx.db, { userId: ctx.user.id }),
      listCategories(ctx.db),
    ]);
    return { rarest, trending, nearby, categories };
  }),
});
