"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton, QueryError } from "@/components/ui/misc";
import { NotebookArt } from "@/components/illustrations";
import { notificationCopy } from "@/lib/notification-copy";
import { timeAgo } from "@/lib/time";
import { useTRPC } from "@/lib/trpc";

type N = RouterOutputs["notification"]["list"]["items"][number];

const TONE = { accent: "text-accent", teal: "text-teal", danger: "text-danger", muted: "text-muted" } as const;

export function NotificationList() {
  const trpc = useTRPC();
  const router = useRouter();
  const list = useInfiniteQuery(
    trpc.notification.list.infiniteQueryOptions({}, { getNextPageParam: (p) => p.nextCursor ?? undefined }),
  );
  const markRead = useMutation(trpc.notification.markRead.mutationOptions({ onSuccess: () => router.refresh() }));
  const marked = useRef(false);
  const unread = list.data?.pages[0]?.unreadCount ?? 0;

  // Mở trang = đã xem: đánh dấu đã đọc một lần (vẫn giữ chấm "mới" trên các mục trong lần xem này).
  useEffect(() => {
    if (!marked.current && unread > 0) {
      marked.current = true;
      markRead.mutate({});
    }
  }, [unread, markRead]);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <main className="flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/home" />
        <h1 className="font-display text-[22px] font-extrabold">Thông báo</h1>
      </header>
      {list.isPending ? (
        <div className="flex flex-col gap-2 px-5 pt-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : list.error ? (
        <div className="px-5 pt-3">
          <QueryError onRetry={() => list.refetch()} />
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 pt-3">
          <EmptyState art={<NotebookArt size={140} />} title="Chưa có thông báo nào" />
        </div>
      ) : (
        <ul className="flex flex-col pt-2">
          {items.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </ul>
      )}
      {list.hasNextPage ? (
        <div className="flex justify-center py-4">
          <Button variant="ghost" size="md" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
            Xem thêm
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function Row({ n }: { n: N }) {
  const c = notificationCopy(n);
  const Icon = c.icon;
  const inner = (
    <>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 ${TONE[c.tone]}`}>
        <Icon size={19} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[15px] leading-snug ${n.read ? "text-muted" : "font-semibold text-text"}`}>{c.text}</span>
        <time className="text-[12px] text-muted" dateTime={n.createdAt.toISOString()}>
          {timeAgo(n.createdAt)}
        </time>
      </span>
      {!n.read ? (
        <span className="size-2.5 shrink-0 rounded-full bg-accent">
          <span className="sr-only">Mới</span>
        </span>
      ) : null}
    </>
  );
  const cls = "flex min-h-16 items-center gap-3 px-5 py-2.5";
  return (
    <li className="border-b border-border last:border-0">
      {c.href ? (
        <Link href={c.href} className={`${cls} transition-colors hover:bg-surface`}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
