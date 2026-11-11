import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

/**
 * Gọi server caller; lỗi "không có / không được xem" của tRPC → trang 404 của Next
 * (không tiết lộ tài nguyên có tồn tại hay không).
 */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (
      e instanceof TRPCError &&
      (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST" || e.code === "FORBIDDEN" || e.code === "PRECONDITION_FAILED")
    ) {
      notFound();
    }
    throw e;
  }
}
