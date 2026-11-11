"use client";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MapPin, Plus, Search, SearchX, TrendingUp, Users, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { formatNumber, skillIcon } from "@/lib/skill-visual";
import { useTRPC } from "@/lib/trpc";

type Home = RouterOutputs["discover"]["home"];
type Summary = Home["rarest"][number];

export function DiscoverView() {
  const trpc = useTRPC();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());

  const home = useQuery({
    ...trpc.discover.home.queryOptions({ categorySlug: category }),
    placeholderData: keepPreviousData,
  });
  const search = useQuery({
    ...trpc.skill.search.queryOptions({ query, categorySlug: category, limit: 20 }),
    enabled: query.length > 0,
  });

  return (
    <main className="flex w-full min-w-0 flex-col">
      <header className="flex flex-col gap-4 px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[28px] font-extrabold leading-tight">Khám phá</h1>
          <Link
            href="/skills/propose"
            className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-[12px] px-2 text-[14px] font-semibold text-accent hover:bg-surface-2"
          >
            <Plus size={18} aria-hidden />
            Đề xuất
          </Link>
        </div>
        <label className="flex min-h-[52px] items-center gap-2.5 rounded-[var(--radius-btn)] border border-border bg-surface px-4 focus-within:border-accent">
          <Search size={18} className="shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            aria-label="Tìm kỹ năng"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Huýt sáo bằng lá, rubik"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted/70 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => setQ("")}
              className="-mr-3 inline-flex size-11 items-center justify-center text-muted"
            >
              <X size={18} aria-hidden />
            </button>
          ) : null}
        </label>
      </header>

      <div role="group" aria-label="Danh mục" className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3">
        <CategoryChip on={category === undefined} onClick={() => setCategory(undefined)}>
          Tất cả
        </CategoryChip>
        {(home.data?.categories ?? []).map((c) => (
          <CategoryChip key={c.slug} on={category === c.slug} onClick={() => setCategory(c.slug)}>
            {c.name}
          </CategoryChip>
        ))}
      </div>

      {query ? (
        <SearchResults results={search.data} pending={search.isPending} q={query} />
      ) : home.isPending ? (
        <div className="flex flex-col gap-4 px-5 pt-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-3">
            <Skeleton className="h-40 w-36" />
            <Skeleton className="h-40 w-36" />
          </div>
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : home.error ? (
        <div role="alert" className="flex flex-col items-start gap-3 px-5 pt-6">
          <p className="text-danger">Không tải được trang khám phá.</p>
          <Button variant="secondary" size="md" onClick={() => home.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : home.data ? (
        <HomeSections data={home.data} />
      ) : null}
    </main>
  );
}

function CategoryChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${
        on ? "bg-text text-bg" : "border border-border text-text hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

function HomeSections({ data }: { data: Home }) {
  return (
    <>
      {data.rarest.length > 0 ? (
        <section aria-labelledby="rarest" className="flex flex-col gap-3 pt-6">
          <h2 id="rarest" className="px-5 text-[17px] font-bold">
            Hiếm nhất
          </h2>
          <ul className="no-scrollbar relative flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
            {data.rarest.map((s) => (
              <li key={s.id} className="snap-start">
                <Link
                  href={`/skills/${s.slug}`}
                  className="flex h-full w-[136px] flex-col items-center gap-2.5 rounded-[var(--radius-card)] bg-surface px-3 pb-4 pt-5 text-center transition-colors hover:bg-surface-2"
                >
                  <LevelPatch
                    categorySlug={s.category.slug}
                    rarity={s.rarity}
                    icon={skillIcon(s.slug, s.category.slug)}
                    size={68}
                  />
                  <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{s.name}</span>
                  <span className="tabular mt-auto inline-flex items-center gap-1 text-[12px] text-muted">
                    <Users size={13} aria-hidden />
                    {formatNumber(s.holderCount)}
                    <span className="sr-only">người đạt cấp cao nhất</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.trending.length > 0 ? (
        <section aria-labelledby="trending" className="flex flex-col pt-6">
          <h2 id="trending" className="px-5 pb-1 text-[17px] font-bold">
            Thịnh hành tuần này
          </h2>
          <ol>
            {data.trending.map((s) => (
              <li key={s.id}>
                <SkillRow
                  s={s}
                  trailing={
                    <span className="tabular inline-flex shrink-0 items-center gap-1 text-[14px] font-bold text-teal">
                      <TrendingUp size={15} aria-hidden />+{s.growthPercent}%
                    </span>
                  }
                />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Nearby nearby={data.nearby} />
    </>
  );
}

function SkillRow({ s, trailing }: { s: Summary; trailing?: React.ReactNode }) {
  return (
    <Link
      href={`/skills/${s.slug}`}
      className="flex min-h-14 items-center gap-3 px-5 py-2 transition-colors hover:bg-surface active:bg-surface-2"
    >
      <LevelPatch categorySlug={s.category.slug} rarity={s.rarity} state="practicing" icon={skillIcon(s.slug, s.category.slug)} size={40} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{s.name}</span>
      {trailing}
    </Link>
  );
}

function Nearby({ nearby }: { nearby: Home["nearby"] }) {
  return (
    <section aria-labelledby="nearby" className="mx-5 mt-6 flex flex-col gap-3 border-t border-border pt-5">
      <h2 id="nearby" className="flex items-center gap-2 text-[17px] font-bold">
        <MapPin size={18} className="text-accent" aria-hidden />
        Gần bạn
      </h2>
      {!nearby.enabled ? (
        <p className="text-[14px] text-muted">Bật vị trí để gặp người luyện cùng.</p>
      ) : nearby.people.length === 0 ? (
        <p className="text-[14px] text-muted">Chưa có ai gần bạn.</p>
      ) : (
        <ul className="-mx-5 flex flex-col">
          {nearby.people.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link
                href={`/u/${p.handle}`}
                className="flex min-h-14 items-center gap-3 px-5 py-2 transition-colors hover:bg-surface"
              >
                <Avatar name={p.displayName} size={40} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{p.displayName}</span>
                  {p.topSkills[0] ? (
                    <span className="truncate text-[13px] text-muted">
                      {p.topSkills[0].name} cấp {p.topSkills[0].level}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
          {nearby.total > 4 ? (
            <li className="tabular px-5 pt-1 text-[13px] text-muted">+{nearby.total - 4} người khác</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function SearchResults({ results, pending, q }: { results: Summary[] | undefined; pending: boolean; q: string }) {
  if (pending) {
    return (
      <div className="flex flex-col gap-2 px-5 pt-6">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }
  if (!results || results.length === 0) {
    return (
      <div className="px-5 pt-6">
        <EmptyState
          icon={SearchX}
          title={`Chưa có kỹ năng "${q}"`}
          action={
            <ButtonLink href={`/skills/propose?name=${encodeURIComponent(q)}`} size="md">
              Đề xuất kỹ năng
            </ButtonLink>
          }
        />
      </div>
    );
  }
  return (
    <section aria-label="Kết quả tìm kiếm" className="pt-4">
      <ul>
        {results.map((s) => (
          <li key={s.id}>
            <SkillRow s={s} />
          </li>
        ))}
      </ul>
    </section>
  );
}
