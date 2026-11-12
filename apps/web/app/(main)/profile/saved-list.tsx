"use client";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { BookmarkArt } from "@/components/illustrations";
import { SaveButton } from "@/components/save-button";
import { ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Avatar, EmptyState, QueryError, Skeleton } from "@/components/ui/misc";
import { milestoneName } from "@/lib/milestone";
import { skillIcon } from "@/lib/skill-visual";
import { timeAgo } from "@/lib/time";
import { useTRPC } from "@/lib/trpc";

type Item = RouterOutputs["save"]["list"]["items"][number];

/** "Đã lưu": kỹ năng, bài viết, video đã lưu; cuộn tới cuối tự tải thêm. */
export function SavedList() {
  const trpc = useTRPC();
  const q = useInfiniteQuery(
    trpc.save.list.infiniteQueryOptions({ limit: 20 }, { getNextPageParam: (p) => p.nextCursor ?? undefined }),
  );
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !q.hasNextPage) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !q.isFetchingNextPage) void q.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [q, q.hasNextPage, q.isFetchingNextPage]);

  if (q.isPending) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (q.error) {
    return (
      <div className="px-5 pt-3">
        <QueryError onRetry={() => q.refetch()} message="Không tải được mục đã lưu." />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="px-5 pt-3">
        <EmptyState
          art={<BookmarkArt size={140} />}
          title="Chưa lưu gì. Bấm biểu tượng Lưu để giữ lại mẹo và kỹ năng hay"
          action={
            <ButtonLink href="/discover" size="md">
              Khám phá
            </ButtonLink>
          }
        />
      </div>
    );
  }
  return (
    <>
      <ul className="flex flex-col">
        {items.map((it) => (
          <li key={`${it.targetType}-${it.targetId}`} className="flex items-center gap-1 border-b border-border pr-3 last:border-0">
            <Row it={it} />
            <SaveButton targetType={it.targetType} targetId={it.targetId} saved size={18} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-4" />
      {q.isFetchingNextPage ? (
        <div className="px-5 pb-4">
          <Skeleton className="h-14" />
        </div>
      ) : null}
    </>
  );
}

const rowCls = "flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-5 transition-colors hover:bg-surface";

function Row({ it }: { it: Item }) {
  if (it.targetType === "skill") {
    const s = it.skill;
    return (
      <Link href={`/skills/${s.slug}`} className={rowCls}>
        <LevelPatch categorySlug={s.category.slug} rarity={s.rarity} state="practicing" icon={skillIcon(s.slug, s.category.slug)} size={40} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">{s.name}</span>
          {s.description ? <span className="truncate text-[13px] text-muted">{s.description}</span> : null}
        </span>
      </Link>
    );
  }
  if (it.targetType === "proof") {
    const p = it.proof;
    const href = p.isMine ? `/proofs/${p.proofId}` : p.status === "passed" ? `/share/${p.proofId}` : `/skills/${p.skill.slug}`;
    return (
      <Link href={href} className={rowCls}>
        <LevelPatch
          categorySlug={p.skill.category.slug}
          rarity={p.skill.rarity}
          state={p.status === "passed" ? "earned" : "practicing"}
          icon={skillIcon(p.skill.slug, p.skill.category.slug)}
          size={40}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">
            {p.isMine ? "Video của bạn" : p.displayName}: mốc {milestoneName(p.levelTitle, p.level)}
          </span>
          <span className="truncate text-[13px] text-muted">{p.skill.name}</span>
        </span>
      </Link>
    );
  }
  const post = it.post;
  const href = post.levelUp ? `/share/${post.levelUp.proofId}` : post.skill ? `/skills/${post.skill.slug}` : `/u/${post.author.handle}`;
  return (
    <Link href={href} className={`${rowCls} items-start`}>
      <Avatar name={post.author.displayName} size={40} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-semibold">
          {post.author.displayName}
          {post.levelUp ? (
            <span className="font-normal">
              {" "}
              xong mốc <b className="font-semibold text-accent">{milestoneName(post.levelUp.levelTitle, post.levelUp.level)}</b>
            </span>
          ) : null}
        </span>
        {post.body && !post.levelUp ? <span className="line-clamp-2 text-[14px] leading-snug">{post.body}</span> : null}
        <span className="truncate text-[13px] text-muted">
          {post.skill ? `${post.skill.name}, ` : ""}
          {timeAgo(post.createdAt)}
        </span>
      </span>
    </Link>
  );
}
