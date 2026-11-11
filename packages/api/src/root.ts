import { publicProcedure, router } from "./trpc";
import { discoverRouter } from "./routers/discover";
import { onboardingRouter } from "./routers/onboarding";
import { profileRouter } from "./routers/profile";
import { levelUpRouter, proofRouter, shareRouter } from "./routers/proof";
import { reviewRouter } from "./routers/review";
import { skillRouter } from "./routers/skill";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),
  /** Người dùng hiện tại (null nếu chưa đăng nhập). Không trả email. */
  me: publicProcedure.query(({ ctx }) => ctx.user),
  skill: skillRouter,
  discover: discoverRouter,
  profile: profileRouter,
  onboarding: onboardingRouter,
  proof: proofRouter,
  review: reviewRouter,
  levelUp: levelUpRouter,
  share: shareRouter,
});

export type AppRouter = typeof appRouter;
