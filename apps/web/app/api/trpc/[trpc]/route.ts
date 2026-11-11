import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@skillverse/api";

// TODO(api): phân giải người dùng từ session cookie / Bearer token qua Auth.js.
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ user: null }),
  });

export { handler as GET, handler as POST };
