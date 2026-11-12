import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Hourglass,
  Lightbulb,
  Lock,
  Plus,
  ShieldAlert,
  TriangleAlert,
  Users,
  Video,
  Zap,
} from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { getServerCaller } from "@/lib/server/trpc";
import { orNotFound } from "@/lib/server-errors";
import { BackButton } from "@/components/ui/back-button";
import { ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { MilestoneBar } from "@/components/ui/milestone";
import { CriteriaVote } from "@/components/criteria-vote";
import { MilestoneRulesInfo } from "@/components/milestone-rules";
import { SummitArt } from "@/components/illustrations";
import { InfoSheet } from "@/components/ui/sheet";
import { milestoneName, titleAt } from "@/lib/milestone";
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
  const nextLevel = myLevel < d.maxLevel ? myLevel + 1 : null;
  const next = d.levels.find((l) => l.level === nextLevel) ?? null;
  const icon = skillIcon(d.slug, d.category.slug);
  const allDone = nextLevel === null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-12">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback="/discover" />
        <Link
          href={`/skills/tree/${d.category.slug}`}
          className="inline-flex min-h-11 items-center px-1 text-[14px] font-semibold text-muted hover:text-text"
        >
          {d.category.name}
        </Link>
      </header>

      <section className="flex items-center gap-4 px-5 pt-2">
        <LevelPatch
          categorySlug={d.category.slug}
          rarity={d.rarity}
          state={myLevel > 0 ? "earned" : d.myPrerequisitesMet === false ? "locked" : "practicing"}
          icon={icon}
          size={76}
          label={d.name}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="font-display text-[27px] font-extrabold leading-[1.15]">{d.name}</h1>
          <MilestoneBar value={myLevel} max={d.maxLevel} showCount showNext={!allDone} />
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

      <section aria-labelledby="milestones" className="mt-6 flex flex-col">
        <div className="flex items-center gap-1 px-5">
          <h2 id="milestones" className="text-[17px] font-bold">
            {d.maxLevel} mốc
          </h2>
          <RulesInfo levels={d.levels} next={next} />
        </div>

        <ol className="mt-2 flex flex-col px-3">
          {d.levels.map((lv, i) => (
            <MilestoneItem
              key={lv.level}
              lv={lv}
              last={i === d.levels.length - 1}
              state={lv.level <= myLevel ? "done" : lv.level === nextLevel ? "next" : "locked"}
              action={lv.level === nextLevel ? <NextAction d={d} /> : null}
            />
          ))}
        </ol>

        {allDone ? (
          <div className="mx-5 mt-4 flex items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-3">
            <SummitArt size={84} className="shrink-0 text-muted" />
            <p className="text-[15px] font-semibold">Xong cả {d.maxLevel} mốc</p>
          </div>
        ) : null}
      </section>

      {d.openProposals.length > 0 || d.levels.length > 0 ? (
        <Proposals slug={d.slug} proposals={d.openProposals} levels={d.levels} />
      ) : null}
    </div>
  );
}

/** Luật chung của việc duyệt, giấu sau ⓘ. */
function RulesInfo({ levels, next }: { levels: Level[]; next: Level | null }) {
  const ref = next ?? levels[levels.length - 1];
  const reviewers = ref?.minReviewers ?? 3;
  const reviewerTitle = ref ? titleAt(levels, ref.minReviewerLevel) : null;
  return (
    <MilestoneRulesInfo reviewers={reviewers} reviewerTitle={reviewerTitle} />
  );
}

function MilestoneItem({
  lv,
  state,
  last,
  action,
}: {
  lv: Level;
  state: "done" | "next" | "locked";
  last: boolean;
  action: React.ReactNode;
}) {
  const name = milestoneName(lv.title, lv.level);
  const task = lv.task;
  const guide = lv.description;
  const stateLabel = state === "done" ? "đã xong" : state === "next" ? "mốc tiếp theo" : "chưa tới";

  const node = (
    <span className="relative flex w-9 shrink-0 flex-col items-center self-stretch">
      <span
        className={`relative z-10 mt-2.5 flex size-8 items-center justify-center rounded-full ${
          state === "done"
            ? "bg-trail text-bg"
            : state === "next"
              ? "border-2 border-accent bg-bg text-accent"
              : "border-2 border-dashed border-border-strong bg-bg text-muted"
        }`}
      >
        {state === "done" ? (
          <Check size={18} strokeWidth={3} aria-hidden />
        ) : state === "next" ? (
          <ArrowRight size={17} strokeWidth={2.6} aria-hidden />
        ) : (
          <Lock size={14} aria-hidden />
        )}
      </span>
      {!last ? (
        <span
          aria-hidden
          className={`-mb-2.5 flex-1 border-l-2 ${state === "done" ? "border-trail/70" : "border-dashed border-border-strong"}`}
        />
      ) : null}
    </span>
  );

  const head = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={`text-[16px] font-bold leading-snug ${state === "locked" ? "text-muted" : "text-text"}`}>
        {name}
        <span className="sr-only">, {stateLabel}</span>
      </span>
      {task ? (
        <span className={`line-clamp-2 text-[14px] leading-snug ${state === "next" ? "text-text" : "text-muted"}`}>{task}</span>
      ) : null}
    </span>
  );

  if (state === "next") {
    return (
      <li className="flex gap-2">
        {node}
        <div className="mb-3 flex min-w-0 flex-1 flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 outline outline-1 outline-accent-line">
          <div className="flex items-start gap-2">
            {head}
            <span className="tabular inline-flex shrink-0 items-center gap-0.5 pt-0.5 text-[13px] font-bold text-accent">
              <Zap size={13} aria-hidden />+{lv.xpReward}
              <span className="sr-only">XP</span>
            </span>
          </div>
          {guide ? (
            <p className="flex items-start gap-2 text-[14px] leading-relaxed text-muted">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-label="Cách làm" />
              <span>{guide}</span>
            </p>
          ) : null}
          {action}
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2">
      {node}
      {guide ? (
        <details className="group mb-1 min-w-0 flex-1">
          <summary className="flex min-h-14 cursor-pointer list-none items-start gap-2 rounded-[12px] px-1 py-2 hover:bg-surface [&::-webkit-details-marker]:hidden">
            {head}
            <ChevronRight
              size={18}
              className="mt-1 shrink-0 text-muted transition-transform group-open:rotate-90"
              aria-label="Cách làm"
            />
          </summary>
          <p className="flex items-start gap-2 px-1 pb-3 text-[14px] leading-relaxed text-muted">
            <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{guide}</span>
          </p>
        </details>
      ) : (
        <div className="mb-1 flex min-h-14 min-w-0 flex-1 px-1 py-2">{head}</div>
      )}
    </li>
  );
}

/** Hành động chính duy nhất, đặt ngay trên mốc kế tiếp. */
function NextAction({ d }: { d: Detail }) {
  if (d.myPendingProof) {
    return (
      <ButtonLink href={`/proofs/${d.myPendingProof.proofId}`} variant="secondary" className="w-full">
        <Hourglass size={18} aria-hidden />
        Chờ duyệt
      </ButtonLink>
    );
  }
  if (d.myPrerequisitesMet === false) {
    return (
      <ButtonLink href={`/skills/tree/${d.category.slug}`} variant="secondary" className="w-full">
        <Lock size={18} aria-hidden />
        Xem điều kiện
      </ButtonLink>
    );
  }
  return (
    <ButtonLink href={`/proof/new?skill=${d.slug}`} className="w-full">
      <Video size={20} aria-hidden />
      Quay video
    </ButtonLink>
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
                  {(p.summary ?? p.proposedCriteria[0]?.text ?? "").replace(/^Cấp\s*\d+\s*:\s*/i, "")}
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
