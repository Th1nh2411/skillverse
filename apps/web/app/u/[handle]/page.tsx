import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getServerCaller, getViewer } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { ReportSheet } from "@/components/report-sheet";
import { BackButton } from "@/components/ui/back-button";
import { SkillProgressRow } from "@/components/skill-progress";
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
  const viewer = await getViewer();
  const [mine, theirs, swaps] = await Promise.all([
    viewer ? api.profile.skills({ handle: viewer.handle }) : Promise.resolve([]),
    api.profile.skills({ handle: p.handle }),
    api.swap.list(),
  ]);
  const swap = swaps.find((s) => s.other.handle === p.handle && (s.status === "proposed" || s.status === "accepted")) ?? null;

  // profile.skills: toàn bộ kỹ năng cấp ≥ 1 (không bị cắt như featuredSkills).
  const myTeach = mine.map((s) => ({ id: s.skillId, name: s.name }));
  const theirTeach = theirs.map((s) => ({ id: s.skillId, name: s.name }));

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
            <span>Hạng {p.xp.level}</span>
            <span className="inline-flex items-center gap-1 text-teal">
              <ShieldCheck size={14} aria-hidden />
              <span className="sr-only">Uy tín duyệt</span>
              {p.reputation}
            </span>
            <InfoSheet title="Uy tín duyệt" label="Cách tính uy tín duyệt">
              Uy tín tăng khi phiếu duyệt trùng với đa số người duyệt, giảm khi trái. Người uy tín cao được ưu tiên duyệt các mốc khó.
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
          Kỹ năng
        </h2>
        {p.featuredSkills.length === 0 ? (
          <p className="px-5 pt-2 text-[14px] text-muted">Chưa xong mốc nào.</p>
        ) : (
          <ul className="mt-1 flex flex-col">
            {p.featuredSkills.map((s) => (
              <li key={s.skillId}>
                <SkillProgressRow s={s} patchSize={44} />
              </li>
            ))}
          </ul>
        )}
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
