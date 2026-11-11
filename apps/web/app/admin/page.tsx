import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/server/trpc";
import { AdminView } from "./admin-view";

export const metadata: Metadata = { title: "Quản trị" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Chỉ biên tập viên; người khác thấy 404 (không lộ trang tồn tại). api cũng tự kiểm tra quyền.
  if (!(await getViewer())?.isEditor) notFound();
  const { tab } = await searchParams;
  return <AdminView initialTab={tab === "disputed" || tab === "appeals" || tab === "proposals" ? tab : "reports"} />;
}
