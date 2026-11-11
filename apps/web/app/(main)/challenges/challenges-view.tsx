"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Crown, ShieldCheck, Swords, Trophy, Users, Zap } from "lucide-react";
import { useId, useState } from "react";
import type { RouterOutputs } from "@skillverse/api";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { InfoSheet } from "@/components/ui/sheet";
import { formatNumber } from "@/lib/skill-visual";
import { clockTime, timeLeft } from "@/lib/time";
import { useTRPC } from "@/lib/trpc";

type Tab = "active" | "duels" | "pending";
type Challenge = RouterOutputs["challenge"]["list"][number];
type Duel = RouterOutputs["duel"]["list"][number];
type Pending = RouterOutputs["challenge"]["pendingProofs"]["items"][number];

export function ChallengesView({ initialTab }: { initialTab: Tab }) {
  const trpc = useTRPC();
  const id = useId();
  const [tab, setTab] = useState<Tab>(initialTab);
  // Số trên tab "Chờ duyệt" cần ngay, nên luôn tải.
  const pending = useQuery(trpc.challenge.pendingProofs.queryOptions());

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "active", label: "Đang diễn ra" },
    { key: "duels", label: "Đấu 1v1" },
    { key: "pending", label: "Chờ duyệt", count: pending.data?.total },
  ];

  return (
    <main className="flex flex-col">
      <header className="px-5 pt-5">
        <h1 className="font-display text-[28px] font-extrabold leading-tight">Thử thách</h1>
      </header>
      <div role="tablist" aria-label="Loại thử thách" className="mx-5 mt-3 grid grid-cols-3 border-b border-border">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`${id}-${t.key}`}
              aria-selected={on}
              aria-controls={`${id}-panel`}
              onClick={() => {
                setTab(t.key);
                window.history.replaceState(null, "", t.key === "active" ? "/challenges" : `/challenges?tab=${t.key}`);
              }}
              className={`-mb-px inline-flex min-h-12 items-center justify-center gap-1.5 border-b-2 text-[14px] font-semibold transition-colors ${
                on ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
              {t.count ? (
                <span className="tabular rounded-full bg-surface-3 px-1.5 text-[12px] font-bold text-text">{t.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="pt-4">
        {tab === "active" ? <ActiveChallenges /> : tab === "duels" ? <Duels /> : <PendingProofs q={pending} />}
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3 px-5">
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
    </div>
  );
}

function ActiveChallenges() {
  const trpc = useTRPC();
  const q = useQuery(trpc.challenge.list.queryOptions());
  if (q.isPending) return <Loading />;
  if (!q.data?.length)
    return (
      <div className="px-5">
        <EmptyState icon={Trophy} title="Chưa có thử thách nào đang diễn ra" />
      </div>
    );
  return (
    <ul className="flex flex-col gap-4 px-5">
      {q.data.map((c) => (
        <ChallengeCard key={c.id} c={c} />
      ))}
    </ul>
  );
}

function ChallengeCard({ c }: { c: Challenge }) {
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-accent-line bg-accent-soft p-4">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <Link href={`/skills/${c.skill.slug}`} className="font-semibold text-accent hover:underline">
          {c.skill.name}
        </Link>
        <span className="tabular inline-flex items-center gap-1 text-muted">
          <Clock size={14} aria-hidden />
          {timeLeft(c.endsAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[22px] font-extrabold leading-tight">{c.title}</h2>
        {c.description ? <p className="text-[14px] leading-relaxed text-[#d9c9a8]">{c.description}</p> : null}
      </div>
      {c.items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {c.items.map((it) => (
            <li key={it} className="flex items-start gap-2 text-[14px] leading-snug">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              {it}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="tabular flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Users size={14} aria-hidden />
            {formatNumber(c.participantCount)}
            <span className="sr-only">người tham gia</span>
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-accent">
            <Zap size={14} aria-hidden />+{c.xpReward} XP
          </span>
        </span>
        {c.joined ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-teal">
            <Check size={16} aria-hidden />
            Đã tham gia
          </span>
        ) : (
          <ButtonLink href={`/proof/new?skill=${c.skill.slug}&challenge=${c.id}`} size="md">
            Tham gia
          </ButtonLink>
        )}
      </div>
    </li>
  );
}

function Duels() {
  const trpc = useTRPC();
  const q = useQuery(trpc.duel.list.queryOptions());
  if (q.isPending) return <Loading />;
  if (!q.data?.length)
    return (
      <div className="px-5">
        <EmptyState icon={Swords} title="Chưa có trận đấu nào" />
      </div>
    );
  return (
    <ul className="flex flex-col gap-4 px-5">
      {q.data.map((d) => (
        <DuelCard key={d.id} d={d} />
      ))}
    </ul>
  );
}

function DuelCard({ d }: { d: Duel }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const vote = useMutation(
    trpc.duel.vote.mutationOptions({ onSuccess: () => qc.invalidateQueries({ queryKey: trpc.duel.list.queryKey() }) }),
  );
  const total = d.sides.reduce((n, s) => n + s.votes, 0);
  return (
    <li className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-[16px] font-bold">{d.skill.name}</h2>
          <p className="text-[13px] text-muted">{d.metric}</p>
        </div>
        <span className="tabular shrink-0 text-[13px] text-muted">
          {d.closed ? "Đã kết thúc" : `Bỏ phiếu tới ${clockTime(d.voteEndsAt)}`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {d.sides.map((s) => {
          const mine = d.myVote === s.userId;
          const won = d.closed && d.winnerId === s.userId;
          const pct = total > 0 ? Math.round((s.votes / total) * 100) : 0;
          return (
            <div
              key={s.userId}
              className={`flex min-w-0 flex-col gap-2 rounded-[14px] border p-2.5 ${won ? "border-accent" : mine ? "border-teal" : "border-border"}`}
            >
              {s.video ? (
                <video
                  src={s.video.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-square w-full rounded-[10px] bg-black object-cover"
                />
              ) : (
                <div className="aspect-square w-full rounded-[10px] bg-surface-2" aria-hidden />
              )}
              <Link href={`/u/${s.handle}`} className="flex min-w-0 items-center gap-2">
                <Avatar name={s.displayName} size={28} />
                <span className="truncate text-[14px] font-semibold">{s.displayName}</span>
                {won ? <Crown size={16} className="shrink-0 text-accent" aria-label="Thắng" /> : null}
              </Link>
              {s.caption ? <p className="line-clamp-2 text-[13px] text-muted">{s.caption}</p> : null}
              {d.myVote || d.closed ? (
                <p className="tabular text-[13px] font-semibold">
                  {pct}% <span className="font-normal text-muted">({s.votes} phiếu)</span>
                </p>
              ) : null}
              {d.canVote && !d.myVote ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ duelId: d.id, choice: s.userId })}
                >
                  Bầu {s.displayName.split(" ").at(-1)}
                </Button>
              ) : mine ? (
                <span className="inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-teal">
                  <Check size={15} aria-hidden />
                  Bạn đã bầu
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {vote.error ? (
        <p role="alert" className="text-[13px] text-danger">
          {vote.error.message}
        </p>
      ) : null}
    </li>
  );
}

function PendingProofs({ q }: { q: { isPending: boolean; data?: RouterOutputs["challenge"]["pendingProofs"] } }) {
  if (q.isPending) return <Loading />;
  const items = q.data?.items ?? [];
  if (!items.length)
    return (
      <div className="px-5">
        <EmptyState icon={ShieldCheck} title="Không có bằng chứng nào đang chờ duyệt" />
      </div>
    );
  return (
    <>
      <div className="flex items-center gap-1 px-5 pb-1 text-[13px] text-muted">
        <ShieldCheck size={15} className="text-teal" aria-hidden />
        Người nộp ẩn danh
        <InfoSheet title="Chờ duyệt" label="Cách hoạt động của bằng chứng chờ duyệt">
          Ai cũng xem được bằng chứng đang chờ, nhưng chỉ người được hệ thống chọn ngẫu nhiên mới chấm được. Tên người nộp được ẩn để
          việc duyệt công bằng.
        </InfoSheet>
      </div>
      <ul className="flex flex-col">
        {items.map((p) => (
          <PendingRow key={p.anonymousCode + p.submittedAt.toISOString()} p={p} />
        ))}
      </ul>
    </>
  );
}

function PendingRow({ p }: { p: Pending }) {
  return (
    <li className="flex items-center gap-3.5 border-b border-border px-5 py-3 last:border-0">
      <LevelPatch categorySlug={p.skill.category.slug} rarity={p.skill.rarity} state="practicing" level={p.targetLevel} size={48} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{p.skill.name}</span>
        <span className="tabular truncate text-[13px] text-muted">
          {p.isMine ? "Của bạn" : `Ẩn danh ${p.anonymousCode}`}, lên cấp {p.targetLevel}
        </span>
        <span className="tabular text-[12px] text-muted">
          {p.votes}/{p.required} đã duyệt
        </span>
      </div>
      {p.myAssignmentId ? (
        <ButtonLink href={`/review/${p.myAssignmentId}`} size="sm">
          Xác thực
        </ButtonLink>
      ) : null}
    </li>
  );
}
