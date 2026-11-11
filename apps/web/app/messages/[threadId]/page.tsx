import type { Metadata } from "next";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { Conversation } from "./conversation";

export const metadata: Metadata = { title: "Tin nhắn" };

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const api = await getServerCaller();
  // Kiểm tra quyền + 404 ở server; client tự làm mới sau đó.
  const first = await orNotFound(api.message.list({ threadId }));
  return <Conversation threadId={threadId} other={first.other} />;
}
