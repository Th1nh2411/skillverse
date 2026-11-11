import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContextFromHeaders } from "@skillverse/api";

// Người dùng được phân giải từ cookie phiên Auth.js (web) HOẶC `Authorization: Bearer <session_token>` (mobile).
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContextFromHeaders(req.headers),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${path ?? "?"}:`, error);
          }
        : undefined,
  });

export { handler as GET, handler as POST };
