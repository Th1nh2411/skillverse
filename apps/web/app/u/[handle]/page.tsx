import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { ReportSheet } from "@/components/report-sheet";
import { BackButton } from "@/components/ui/back-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { Avatar } from "@/components/ui/misc";
import { InfoSheet } from "@/components/ui/sheet";
import { formatNumber } from "@/lib/skill-visual";
import { FollowButton, MessageButton } from "./actions";
import { SwapPanel } from "./swap-panel";

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const api = await getServerCaller();
  const p = await api.profile.byHandle({ handle }).catch(() => null);
  return { title: p?.displayName ?? "Hồ sơ" };
}

export default async function PeerProfilePage({ params }: Params) {
  const { handle } = await params;
  const api = await getServerCaller();
  const p = await orNotFound(api.profile.byHandle({ handle }));
  if (p.isMe) redirect("/profile");
  const [me, swaps] = await Promise.all([api.profile.me(), api.swap.list()]);
  const swap = swaps.find((s) => s.other.handle === p.handle && (s.status === "proposed" || s.status === "accepted")) ?? null;

  const myTeach = me.featuredSkills.filter((s) => s.level >= 1).map((s) => ({ id: s.skillId, name: s.name }));
  const theirTeach = p.featuredSkills.filter((s) => s.level >= 1).map((s) => ({ id: s.skillId, name: s.name }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-10">
      <header className="flex items-center justify-between px-3 pt-3">
        <BackButton fallback="/discover" />
        <ReportSheet targetType="user" targetId={p.id} title={`Báo cáo ${p.displayName}`} />
      </header>

      <section className="flex items-center gap-4 px-5 pt-2">
        <Avatar name={p.displayName} size={72} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-display text-[24px] font-extrabold leading-tight">{p.displayName}</h1>
          <div className="tabular flex flex-wrap items-center gap-x-3 text-[14px] text-muted">
            <span>Cấp {p.xp.level}</span>
            <span className="inline-flex items-center gap-1 text-teal">
              <ShieldCheck size={14} aria-hidden />
              Uy tín {p.reputation}
            </span>
            <InfoSheet title="Uy tín duyệt" label="Cách tính uy tín duyệt">
              Uy tín tăng khi phiếu duyệt trùng với đa số người duyệt, giảm khi trái. Người uy tín cao được ưu tiên duyệt cấp cao.
            </InfoSheet>
          </div>
        </div>
      </section>

      <dl className="tabular mx-5 mt-4 flex gap-5 text-[14px]">
        <div className="flex gap-1">
          <dd className="font-bold">{formatNumber(p.stats.skillCount)}</dd>
          <dt className="text-muted">kỹ năng</dt>
        </div>
        <div className="flex gap-1">
          <dd className="font-bold">{formatNumber(p.stats.followerCount)}</dd>
          <dt className="text-muted">người theo dõi</dt>
        </div>
      </dl>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-2.5">
        <FollowButton handle={p.handle} initial={p.viewerFollows} />
        <MessageButton handle={p.handle} />
      </div>

      <section aria-labelledby="featured" className="mt-6 flex flex-col">
        <h2 id="featured" className="px-5 text-[17px] font-bold">
          Kỹ năng nổi bật
        </h2>
        <ul className="mt-1 flex flex-col">
          {p.featuredSkills.map((s) => (
            <li key={s.skillId}>
              <Link
                href={`/skills/${s.slug}`}
                className="flex min-h-14 items-center gap-3.5 px-5 py-2 transition-colors hover:bg-surface"
              >
                <LevelPatch
                  categorySlug={s.category.slug}
                  rarity={s.rarity}
                  state={s.level > 0 ? "earned" : "practicing"}
                  level={s.level > 0 ? s.level : undefined}
                  size={44}
                />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{s.name}</span>
                <span className="tabular shrink-0 text-[13px] text-muted">
                  Cấp {s.level}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <SwapPanel
        handle={p.handle}
        name={p.displayName}
        myTeach={myTeach}
        theirTeach={theirTeach}
        swap={
          swap
            ? {
                status: swap.status,
                role: swap.role,
                mode: swap.mode,
                scheduledAt: swap.scheduledAt ? swap.scheduledAt.toISOString() : null,
                teach: swap.teachSkill.name,
                learn: swap.learnSkill.name,
              }
            : null
        }
      />
    </main>
  );
}
