"use client";
import Link from "next/link";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { MessageCircle, PartyPopper, ShieldCheck, Sprout } from "lucide-react";
import { useState } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { ReportSheet } from "@/components/report-sheet";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { formatNumber } from "@/lib/skill-visual";
import { timeAgo } from "@/lib/time";
import { useTRPC } from "@/lib/trpc";

type Item = RouterOutputs["home"]["feed"]["items"][number];

export function Feed() {
  const trpc = useTRPC();
  const feed = useInfiniteQuery(
    trpc.home.feed.infiniteQueryOptions({ limit: 10 }, { getNextPageParam: (p) => p.nextCursor ?? undefined }),
  );
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const firstPopular = items.findIndex((i) => !i.followed);

  return (
    <section aria-labelledby="feed" className="mt-6 flex flex-col border-t border-border">
      <h2 id="feed" className="sr-only">
        Bảng tin
      </h2>
      {feed.isPending ? (
        <div className="flex flex-col gap-3 px-5 pt-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-32" />
        </div>
      ) : feed.error ? (
        <div role="alert" className="flex flex-col items-start gap-3 px-5 pt-4">
          <p className="text-danger">Không tải được bảng tin.</p>
          <Button variant="secondary" size="md" onClick={() => feed.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 pt-4">
          <EmptyState
            icon={Sprout}
            title="Theo dõi kỹ năng hoặc người luyện để thấy tin ở đây"
            action={
              <ButtonLink href="/discover" size="md">
                Khám phá
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col">
          {items.map((it, i) => (
            <li key={it.id} className="border-b border-border">
              {i === firstPopular && i > 0 ? (
                <p className="px-5 pb-1 pt-4 text-[13px] font-semibold text-muted">Phổ biến trong cộng đồng</p>
              ) : null}
              {it.kind === "level_up" && it.levelUp ? <LevelUpItem it={it} /> : <PostItem it={it} />}
            </li>
          ))}
        </ul>
      )}
      {feed.hasNextPage ? (
        <div className="flex justify-center py-4">
          <Button variant="ghost" size="md" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {feed.isFetchingNextPage ? "Đang tải" : "Xem thêm"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Author({ it }: { it: Item }) {
  return (
    <Link href={`/u/${it.author.handle}`} className="shrink-0" aria-label={it.author.displayName}>
      <Avatar name={it.author.displayName} size={40} />
    </Link>
  );
}

function LevelUpItem({ it }: { it: Item }) {
  const lu = it.levelUp!;
  return (
    <article className="flex gap-3 px-5 py-4">
      <Author it={it} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[15px] leading-snug">
          <Link href={`/u/${it.author.handle}`} className="font-bold hover:underline">
            {it.author.displayName}
          </Link>{" "}
          lên <b className="tabular font-bold text-accent">cấp {lu.level}</b>
          {it.skill ? (
            <>
              {" "}
              <Link href={`/skills/${it.skill.slug}`} className="font-semibold hover:underline">
                {it.skill.name}
              </Link>
            </>
          ) : null}
        </p>
        <p className="tabular flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          {lu.totalVotes > 0 ? (
            <span className="inline-flex items-center gap-1 text-teal">
              <ShieldCheck size={14} aria-hidden />
              {lu.passVotes}/{lu.totalVotes} người duyệt
            </span>
          ) : null}
          <time dateTime={it.createdAt.toISOString()}>{timeAgo(it.createdAt)}</time>
        </p>
        <Actions it={it} />
      </div>
      <Link href={`/share/${lu.proofId}`} aria-label="Xem thẻ thành tích" className="shrink-0 self-start">
        <LevelPatch categorySlug="" state="earned" level={lu.level} size={48} />
      </Link>
    </article>
  );
}

function PostItem({ it }: { it: Item }) {
  return (
    <article className="flex gap-3 px-5 py-4">
      <Author it={it} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-col">
          <p className="text-[15px]">
            <Link href={`/u/${it.author.handle}`} className="font-bold hover:underline">
              {it.author.displayName}
            </Link>{" "}
            <span className="tabular text-[13px] text-muted">· Cấp {it.author.accountLevel}</span>
          </p>
          <p className="truncate text-[13px] text-muted">
            {it.skill ? (
              <>
                <Link href={`/skills/${it.skill.slug}`} className="hover:underline">
                  {it.skill.name}
                </Link>{" "}
                ·{" "}
              </>
            ) : null}
            <time dateTime={it.createdAt.toISOString()}>{timeAgo(it.createdAt)}</time>
          </p>
        </div>
        {it.body ? <p className="whitespace-pre-line text-[15px] leading-relaxed">{it.body}</p> : null}
        <Actions it={it} report />
      </div>
    </article>
  );
}

function Actions({ it, report }: { it: Item; report?: boolean }) {
  const trpc = useTRPC();
  const [state, setState] = useState({ count: it.likeCount, on: it.myReactions.includes("cheer") });
  const react = useMutation(
    trpc.post.react.mutationOptions({
      onSuccess: (r) => setState({ count: r.likeCount, on: r.myReactions.includes("cheer") }),
      onError: () => setState({ count: it.likeCount, on: it.myReactions.includes("cheer") }),
    }),
  );

  return (
    <div className="-ml-2.5 flex items-center gap-1">
      <button
        type="button"
        aria-pressed={state.on}
        aria-label={state.on ? "Bỏ cổ vũ" : "Cổ vũ"}
        disabled={react.isPending}
        onClick={() => {
          const on = !state.on;
          setState((s) => ({ on, count: s.count + (on ? 1 : -1) }));
          react.mutate({ postId: it.id, kind: "cheer", on });
        }}
        className={`tabular inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-2.5 text-[14px] font-semibold transition-colors hover:bg-surface-2 ${
          state.on ? "text-accent" : "text-muted"
        }`}
      >
        <PartyPopper size={18} aria-hidden />
        {formatNumber(state.count)}
      </button>
      {it.commentCount > 0 ? (
        <span className="tabular inline-flex min-h-11 items-center gap-1.5 px-2.5 text-[14px] font-semibold text-muted">
          <MessageCircle size={18} aria-hidden />
          {formatNumber(it.commentCount)}
          <span className="sr-only">bình luận</span>
        </span>
      ) : null}
      {report ? (
        <span className="ml-auto">
          <ReportSheet targetType="post" targetId={it.id} title="Báo cáo bài viết" compact label="Báo cáo bài viết" />
        </span>
      ) : null}
    </div>
  );
}
