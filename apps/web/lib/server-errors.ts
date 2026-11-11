import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

/** Gọi server caller; lỗi NOT_FOUND của tRPC → trang 404 của Next. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof TRPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) notFound();
    throw e;
  }
}
