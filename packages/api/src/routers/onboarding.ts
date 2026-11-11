import { completeOnboarding, getOnboardingOptions } from "@skillverse/domain";
import { onboardingCompleteInput } from "@skillverse/validation";
import { protectedProcedure, router } from "../trpc";

export const onboardingRouter = router({
  /** Danh mục + kỹ năng gợi ý để chọn khi onboarding. */
  options: protectedProcedure.query(({ ctx }) => getOnboardingOptions(ctx.db)),

  /** Chọn ≥ 3 kỹ năng (+ trình độ tự đánh giá, chỉ để gợi ý). Trả thử thách đầu tiên gợi ý. */
  complete: protectedProcedure
    .input(onboardingCompleteInput)
    .mutation(({ ctx, input }) =>
      completeOnboarding(ctx.db, { userId: ctx.user.id, skillIds: input.skillIds, selfLevels: input.selfLevels }),
    ),
});
