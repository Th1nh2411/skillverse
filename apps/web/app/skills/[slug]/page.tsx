import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Plus,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { BackButton } from "@/components/ui/back-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { CriteriaVote } from "@/components/criteria-vote";
import { SaveButton } from "@/components/save-button";
import { CategoryArt } from "@/components/illustrations";
import { MilestoneTrail } from "./milestone-trail";
import { InfoSheet } from "@/components/ui/sheet";
import { titleAt } from "@/lib/milestone";
import { formatNumber, skillIcon } from "@/lib/skill-visual";

type Detail = RouterOutputs["skill"]["detail"];
type Level = Detail["levels"][number];
type Proposal = Detail["openProposals"][number];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const api = await getServerCaller();
  const d = await api.skill.detail({ slug }).catch(() => null);
  return { title: d?.name ?? "Kỹ năng" };
}

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const api = await getServerCaller();
  const d = await orNotFound(api.skill.detail({ slug }));
  const myLevel = d.myLevel ?? 0;
  const verifyRef = d.levels.find((l) => l.level === myLevel + 1) ?? d.levels[d.levels.length - 1];
  const icon = skillIcon(d.slug, d.category.slug);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-12">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/discover" />
        <Link
          href={`/skills/tree/${d.category.slug}`}
          className="inline-flex min-h-11 flex-1 items-center px-1 text-[14px] font-semibold text-muted hover:text-text"
        >
          {d.category.name}
        </Link>
        <SaveButton targetType="skill" targetId={d.id} saved={d.saved} />
      </header>

      <section className="relative mx-3 mt-1 flex items-center gap-4 overflow-hidden rounded-[20px] border border-border bg-surface bg-dotgrid px-3.5 py-4">
        <CategoryArt
          slug={d.category.slug}
          size={150}
          className="pointer-events-none absolute -bottom-4 -right-6 text-muted opacity-40"
        />
        <LevelPatch
          categorySlug={d.category.slug}
          rarity={d.rarity}
          state={myLevel > 0 ? "earned" : d.myPrerequisitesMet === false && d.selfLevel === 0 ? "locked" : "practicing"}
          icon={icon}
          size={76}
          label={d.name}
          className="relative shrink-0"
        />
        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-display text-[27px] font-extrabold leading-[1.15]">{d.name}</h1>
          {d.selfLevel > 0 ? (
            <p className="tabular flex flex-wrap items-center gap-x-3 text-[14px] text-muted">
              {d.selfLevel > myLevel ? (
                <span className="inline-flex items-center gap-1">
                  <Check size={15} strokeWidth={3} aria-hidden />
                  Xong {d.selfLevel} mốc
                </span>
              ) : null}
              {myLevel > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-accent">
                  <BadgeCheck size={16} aria-hidden />
                  {myLevel} đã xác nhận
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3">
        <span className="tabular inline-flex items-center gap-1.5 text-[13px] text-muted">
          <Users size={14} aria-hidden />
          <b className="font-bold text-text">{formatNumber(d.practicingCount)}</b> đang luyện
        </span>
        {d.riskLevel !== "none" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft py-0.5 pl-2.5 pr-1 text-[13px] font-semibold text-accent">
            {d.riskLevel === "high" ? <ShieldAlert size={15} aria-hidden /> : <TriangleAlert size={15} aria-hidden />}
            {d.riskLevel === "high" ? "Rủi ro cao" : "Cần cẩn thận"}
            <InfoSheet title="An toàn khi luyện" label="Cách luyện an toàn">
              Luôn luyện ở nơi an toàn, có người biết bạn đang làm gì và có sẵn dụng cụ xử lý sự cố (nước dập lửa, bộ sơ cứu). Video
              quay cảnh nguy hiểm cho bản thân hoặc người khác sẽ bị từ chối.
            </InfoSheet>
          </span>
        ) : null}
      </div>
      {d.description ? <p className="line-clamp-2 px-5 pt-2 text-[14px] leading-snug text-muted">{d.description}</p> : null}

      <MilestoneTrail
        slug={d.slug}
        categorySlug={d.category.slug}
        levels={d.levels.map((l) => ({
          skillLevelId: l.skillLevelId,
          level: l.level,
          title: l.title,
          task: l.task,
          description: l.description,
          xpReward: l.xpReward,
          checked: l.checked,
          verified: l.verified,
        }))}
        verifiedLevel={myLevel}
        pendingProofId={d.myPendingProof?.proofId ?? null}
        prerequisitesMet={d.myPrerequisitesMet}
        reviewers={verifyRef?.minReviewers ?? 3}
        reviewerTitle={verifyRef ? titleAt(d.levels, verifyRef.minReviewerLevel) : null}
      />

      {d.openProposals.length > 0 || d.levels.length > 0 ? (
        <Proposals slug={d.slug} proposals={d.openProposals} levels={d.levels} />
      ) : null}
    </div>
  );
}

function Proposals({ slug, proposals, levels }: { slug: string; proposals: Proposal[]; levels: Level[] }) {
  return (
    <section aria-labelledby="proposals" className="mx-5 mt-8 flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="proposals" className="text-[16px] font-bold">
          Góp ý mốc
        </h2>
        <Link
          href={`/skills/${slug}/suggest`}
          className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-[12px] px-2 text-[14px] font-semibold text-accent hover:bg-surface-2"
        >
          <Plus size={16} aria-hidden />
          Góp ý
        </Link>
      </div>
      {proposals.length === 0 ? (
        <p className="text-[14px] text-muted">Chưa có góp ý nào đang mở.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {proposals.slice(0, 3).map((p) => (
            <li key={p.id} className="flex flex-col gap-2.5">
              <Link href={`/proposals/${p.id}`} className="flex min-h-11 items-center gap-2 text-[14px] leading-snug hover:underline">
                <span className="flex-1">
                  {p.targetLevel ? <b className="font-semibold">{titleAt(levels, p.targetLevel)}: </b> : null}
                  {(p.summary ?? p.proposedCriteria[0]?.text ?? "").replace(/^(Cấp\s*\d+|Mốc [^:]{1,40})\s*:\s*/i, "")}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
              </Link>
              <CriteriaVote
                proposalId={p.id}
                rule={p.rule}
                voterMinTitle={titleAt(levels, p.rule.voter_min_level)}
                tally={{ agreeRatio: p.agreeRatio, weightedVoteCount: p.weightedVoteCount, voteCount: p.voteCount }}
                myVote={p.myVote}
                open={p.status === "voting" || p.status === "gathering"}
              />
            </li>
          ))}
        </ul>
      )}
      {proposals.length > 3 ? (
        <Link
          href={`/proposals?kind=edit_criteria&skill=${slug}`}
          className="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent hover:underline"
        >
          Xem tất cả {proposals.length} góp ý
        </Link>
      ) : null}
    </section>
  );
}
