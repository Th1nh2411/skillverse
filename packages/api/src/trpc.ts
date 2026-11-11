import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { DomainError } from "@skillverse/domain";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/** Map DomainError → TRPCError để UI nhận thông điệp tiếng Việt. */
const domainErrors = t.middleware(async ({ next }) => {
  const res = await next();
  if (!res.ok && res.error.cause instanceof DomainError) {
    const e = res.error.cause;
    throw new TRPCError({ code: e.code, message: e.message, cause: e });
  }
  return res;
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure.use(domainErrors);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.isEditor) throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ biên tập viên được thực hiện." });
  return next();
});
