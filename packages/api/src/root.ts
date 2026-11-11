import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true as const })),
  me: publicProcedure.query(({ ctx }) => ctx.user),
});

export type AppRouter = typeof appRouter;
