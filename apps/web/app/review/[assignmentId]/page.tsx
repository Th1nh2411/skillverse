import type { Metadata } from "next";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Duyệt bằng chứng" };

export default async function ReviewTaskPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const api = await getServerCaller();
  // Không được phân công / không tồn tại → 404 (không lộ bằng chứng có tồn tại hay không).
  const task = await orNotFound(api.review.task({ assignmentId }));
  return <ReviewForm task={task} />;
}
