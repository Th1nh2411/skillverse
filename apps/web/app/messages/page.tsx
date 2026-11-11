import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { BackButton } from "@/components/ui/back-button";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Tin nhắn" };

export default async function MessagesPage() {
  const api = await getServerCaller();
  const threads = await api.message.threads();
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/home" />
        <h1 className="font-display text-[22px] font-extrabold">Tin nhắn</h1>
      </header>
      {threads.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState icon={MessagesSquare} title="Chưa có tin nhắn. Nhắn từ hồ sơ một người luyện cùng kỹ năng." />
        </div>
      ) : (
        <ul className="flex flex-col pt-2">
          {threads.map((t) => (
            <li key={t.threadId}>
              <Link
                href={`/messages/${t.threadId}`}
                className="flex min-h-16 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface"
              >
                <Avatar name={t.other.displayName} size={44} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[15px] ${t.unread > 0 ? "font-bold" : "font-semibold"}`}>{t.other.displayName}</span>
                    {t.lastMessage ? (
                      <time className="shrink-0 text-[12px] text-muted" dateTime={t.lastMessage.createdAt.toISOString()}>
                        {timeAgo(t.lastMessage.createdAt)}
                      </time>
                    ) : null}
                  </span>
                  <span className={`truncate text-[14px] ${t.unread > 0 ? "text-text" : "text-muted"}`}>
                    {t.lastMessage ? `${t.lastMessage.mine ? "Bạn: " : ""}${t.lastMessage.body}` : "Bắt đầu trò chuyện"}
                  </span>
                </span>
                {t.unread > 0 ? (
                  <span className="tabular min-w-5 rounded-full bg-accent px-1.5 text-center text-[12px] font-bold text-on-accent">
                    {t.unread}
                    <span className="sr-only"> tin chưa đọc</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
